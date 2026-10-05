require "csv"
require "set"

# CSV の本をまとめて登録する（アカウント画面の「CSV」→ 読み込み。POST /api/books/import）。
# 書き出し（BookCsvExporter）と同じ見出し・日本語の名前を使い、列は見出しの名前で探す（並び替え・足りない列も可）。
# - 間違った行が 1 行でもあれば何も登録せず、行番号付きのエラーを返す
# - 自分の本と同じ ISBN（両方にあるとき）か同じタイトル＋著者の行は飛ばす（同じ CSV の中で重なった 2 つ目以降も）。
#   タイトル＋著者は DB と同じ比べ方（半角・全角、大文字・小文字、ひらがな・カタカナなどの違いは同じとみなす）
# - dry_run: true は登録せずに件数だけ返す（取り込む前の確認）
# - 登録日・開始日・読了日があれば、その日付で状態の履歴を作り直す。表紙は取りに行かない
class BookCsvImporter
  MAX_ROWS = 1000
  STATUSES = BookCsvExporter::STATUS_LABELS.invert.freeze
  GENRES = BookCsvExporter::GENRE_LABELS.invert.freeze
  MEDIA_TYPES = BookCsvExporter::MEDIA_TYPE_LABELS.invert.freeze
  DATE_COLUMNS = { "want_to_read" => "登録日", "reading" => "開始日", "read" => "読了日" }.freeze
  # Excel などで保存し直すと 2026/9/1 の形になることがあるので、- と / の両方を受け付ける
  DATE_FORMAT = %r{\A(\d{4})[-/](\d{1,2})[-/](\d{1,2})\z}

  # ok: エラーが無いか / errors: 行番号付きのエラー / to_create: 登録する（した）冊数 / skipped: 飛ばした行 [{ line:, title: }]
  Result = Struct.new(:ok, :errors, :to_create, :skipped, keyword_init: true)

  def initialize(user, csv_text)
    @user = user
    @csv_text = csv_text.to_s.delete_prefix(BookCsvExporter::BOM)
  end

  def call(dry_run:)
    table = parse
    return failure(@parse_error) unless table

    plans, skipped, errors = plan_rows(table)
    return failure(*errors) if errors.any?

    create_books(plans) unless dry_run
    Result.new(ok: true, errors: [], to_create: plans.size, skipped: skipped)
  end

  private

  def parse
    table = CSV.parse(@csv_text, headers: true)
    if !table.headers.include?("タイトル")
      @parse_error = t("no_title_column")
    elsif table.empty?
      @parse_error = t("empty")
    elsif table.size > MAX_ROWS
      @parse_error = t("too_many_rows", max: MAX_ROWS, count: table.size)
    else
      return table
    end
    nil
  rescue CSV::MalformedCSVError => e
    @parse_error = t("malformed", detail: e.message)
    nil
  end

  # 行ごとに検査し、登録する本の予定・飛ばす行・エラーに分ける
  def plan_rows(table)
    candidates = []
    errors = []
    table.each.with_index(2) do |row, line|
      attrs, dates, row_errors = read_row(row)
      if row_errors.empty?
        book = Book.new(attrs.merge(user: @user)) # 検査だけ（user.books に足さない）
        row_errors = book.errors.full_messages unless book.valid?
      end
      if row_errors.any?
        errors.concat(row_errors.map { |message| t("row", line: line, message: message) })
      else
        candidates << { line: line, book: book, plan: { attrs: attrs, tag_names: split_tags(row["タグ"]), dates: dates } }
      end
    end
    return [ [], [], errors ] if errors.any?

    plans, skipped = remove_duplicates(candidates)
    [ plans, skipped, errors ]
  end

  # 自分の本と同じ ISBN か同じタイトル＋著者の行を飛ばす（CSV の中で重なった 2 つ目以降も）
  def remove_duplicates(candidates)
    existing = @user.books.pluck(:title, :author).map { |title, author| [ title.strip, author.to_s.strip ] }
    new_pairs = candidates.map { |c| [ c[:book].title.strip, c[:book].author.to_s.strip ] }
    keys = comparison_keys((existing + new_pairs).flatten)
    title_authors = existing.to_set { |pair| pair.map(&keys) }
    isbns = @user.books.where.not(isbn: nil).pluck(:isbn).to_set

    plans = []
    skipped = []
    candidates.zip(new_pairs) do |candidate, pair|
      book = candidate[:book]
      key = pair.map(&keys)
      if (book.isbn.present? && isbns.include?(book.isbn)) || title_authors.include?(key)
        skipped << { line: candidate[:line], title: book.title }
        next
      end
      isbns << book.isbn if book.isbn.present?
      title_authors << key
      plans << candidate[:plan]
    end
    [ plans, skipped ]
  end

  # DB（照合順序 utf8mb4_0900_ai_ci）が同じとみなす文字列に同じキーを返す（{ 文字列 => キー }）。
  # Ruby の == は「第2版」と「第２版」、「Ruby」と「ruby」、「はな」と「ハナ」を別とみなすので、
  # MySQL が文字を比べるときに使う重み（WEIGHT_STRING）を DB に出させて、キーワード検索・タグと同じ比べ方にそろえる
  def comparison_keys(strings)
    connection = Book.connection
    strings.uniq.each_slice(500).each_with_object({}) do |slice, keys|
      sql = slice.each_with_index.map do |string, i|
        "SELECT #{i} AS i, WEIGHT_STRING(#{connection.quote(string)} COLLATE utf8mb4_0900_ai_ci) AS w"
      end.join(" UNION ALL ")
      weights = connection.select_rows(sql).to_h
      slice.each_with_index { |string, i| keys[string] = weights.fetch(i) }
    end
  end

  # 1 行を Book の属性・状態ごとの日付・エラーに読み替える
  def read_row(row)
    errors = []
    title = cell(row, "タイトル")
    errors << t("title_blank") if title.nil?
    attrs = {
      title: title,
      author: cell(row, "著者"),
      status: label(row, "状態", STATUSES, "want_to_read", errors),
      genre: label(row, "ジャンル", GENRES, "other", errors),
      media_type: label(row, "形態", MEDIA_TYPES, "book", errors),
      rating: rating(row, errors),
      memo: cell(row, "メモ"),
      isbn: cell(row, "ISBN")
    }
    dates = DATE_COLUMNS.to_h { |status, column| [ status, date(row, column, errors) ] }.compact
    [ attrs, dates, errors ]
  end

  def cell(row, column)
    row[column].to_s.strip.presence
  end

  # 日本語の名前を enum のキーにする。空なら既定値
  def label(row, column, table, default, errors)
    value = cell(row, column)
    return default if value.nil?

    table.fetch(value) do
      errors << t("invalid_label", column: column, choices: table.keys.join("・"), value: value)
      default
    end
  end

  # 空・0 は未評価（nil）。1〜5 だけ受け付ける
  def rating(row, errors)
    value = cell(row, "評価")
    return nil if value.nil? || value == "0"
    return value.to_i if value.match?(/\A[1-5]\z/)

    errors << t("invalid_rating", value: value)
    nil
  end

  def date(row, column, errors)
    value = cell(row, column)
    return nil if value.nil?

    match = DATE_FORMAT.match(value)
    return Date.new(*match.captures.map(&:to_i)) if match

    errors << t("invalid_date", column: column, value: value)
    nil
  rescue Date::Error
    errors << t("invalid_date", column: column, value: value)
    nil
  end

  def split_tags(value)
    value.to_s.split(BookCsvExporter::TAG_SEPARATOR)
  end

  def create_books(plans)
    Book.transaction do
      plans.each do |plan|
        book = @user.books.create!(plan[:attrs].merge(tag_names: plan[:tag_names]))
        restore_status_events(book, plan[:dates]) if plan[:dates].any?
      end
    end
  end

  # 作成時に付いた「今日」の履歴を、CSV の日付で作り直す。今の状態の日付が CSV に無ければ今日のまま残す
  def restore_status_events(book, dates)
    book.status_events.delete_all
    dates.each { |status, occurred_on| book.status_events.create!(status: status, occurred_on: occurred_on) }
    book.status_events.create!(status: book.status, occurred_on: Date.current) unless dates.key?(book.status)
  end

  def failure(*errors)
    Result.new(ok: false, errors: errors, to_create: 0, skipped: [])
  end

  def t(key, **options)
    I18n.t("api.errors.csv_import.#{key}", **options)
  end
end
