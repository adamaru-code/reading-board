require "test_helper"

class BookCsvImporterTest < ActiveSupport::TestCase
  setup do
    @user = users(:owner)
    @other = users(:other)
  end

  def import(csv, dry_run: false, user: @other)
    BookCsvImporter.new(user, csv).call(dry_run: dry_run)
  end

  def csv(*rows, headers: BookCsvExporter::HEADERS)
    CSV.generate { |out| ([ headers ] + rows).each { |row| out << row } }
  end

  test "書き出した CSV をそのまま別のユーザーで読み込むと、同じ値・タグ・日付の本ができる（往復）" do
    book = travel_to(Date.new(2026, 9, 1)) { @user.books.create!(title: "こころ", author: "夏目漱石", status: :reading, genre: :classic_novel, rating: 4, memo: "1行目, カンマ\n2行目", isbn: "9784101010137", tag_names: %w[名著 再読したい]) }
    travel_to(Date.new(2026, 9, 11)) { book.update!(status: :read) }
    exported = BookCsvExporter.call(@user.books.where(id: book.id).includes(:tags, :status_events))

    result = import(exported)
    assert result.ok, result.errors.inspect
    assert_equal 1, result.to_create

    copied = @other.books.includes(:tags, :status_events).find_by!(title: "こころ")
    assert_equal [ "夏目漱石", "read", "classic_novel", "book", 4, "1行目, カンマ\n2行目", "9784101010137" ],
      [ copied.author, copied.status, copied.genre, copied.media_type, copied.rating, copied.memo, copied.isbn ]
    assert_equal %w[名著 再読したい], copied.tag_names
    assert_nil copied.registered_on
    assert_equal [ Date.new(2026, 9, 1), Date.new(2026, 9, 11), 10 ], [ copied.started_on, copied.finished_on, copied.duration_days ]
  end

  test "列は見出しの名前で探す（並び替え・足りない列も可）。空の状態・ジャンル・形態は既定値" do
    result = import(csv([ "達人", "3" ], headers: %w[タイトル 評価]))
    assert result.ok, result.errors.inspect
    book = @other.books.find_by!(title: "達人")
    assert_equal [ "want_to_read", "other", "book", 3 ], [ book.status, book.genre, book.media_type, book.rating ]
    assert_equal Date.current, book.registered_on # 日付が無ければ今日
  end

  test "日付は 2026/9/1 の形（Excel で保存し直したとき）も受け付け、今の状態の日付が無ければ今日を足す" do
    travel_to Date.new(2026, 10, 4) do
      import(csv([ "本", nil, "読書中", nil, nil, nil, nil, nil, nil, "2026/9/1", nil, nil, nil ]))
    end
    book = @other.books.includes(:status_events).find_by!(title: "本")
    assert_equal Date.new(2026, 9, 1), book.registered_on
    assert_equal Date.new(2026, 10, 4), book.started_on # 読書中の日付が CSV に無いので今日
  end

  test "自分の本と同じ ISBN・同じタイトル＋著者の行と、CSV の中で重なった 2 つ目は飛ばす（他人の本は重複にしない）" do
    @other.books.create!(title: "既存", author: "A")
    @other.books.create!(title: "ISBN の本", isbn: "9784101010137")
    @user.books.create!(title: "他人だけが持つ本")
    rows = [
      [ "既存", "A" ],                              # 2 行目：同じタイトル＋著者
      [ "別の題", nil, nil, nil, nil, nil, nil, nil, "978-4-10-101013-7" ], # 3 行目：同じ ISBN（ハイフン付き）
      [ "新しい本", "B" ],                          # 4 行目：足す
      [ "新しい本", "B" ],                          # 5 行目：CSV の中で重なった
      [ "他人だけが持つ本" ]                         # 6 行目：足す
    ]
    result = import(csv(*rows), dry_run: true)
    assert result.ok
    assert_equal 2, result.to_create
    assert_equal [ 2, 3, 5 ], result.skipped.map { |s| s[:line] }
    assert_equal 2, @other.books.count # dry_run は登録しない
  end

  test "タイトル＋著者は DB と同じ比べ方（半角・全角、大文字・小文字、ひらがな・カタカナ）で重複とみなす" do
    @other.books.create!(title: "第2版", author: "A")
    @other.books.create!(title: "Ruby入門", author: "Matz")
    @other.books.create!(title: "はな")
    rows = [
      [ "第２版", "Ａ" ],      # 2 行目：全角
      [ "ruby入門", "MATZ" ], # 3 行目：大文字・小文字
      [ "ハナ" ],             # 4 行目：カタカナ
      [ "ＩＴ入門" ],         # 5 行目：足す
      [ "IT入門" ]            # 6 行目：CSV の中で 5 行目と重なった
    ]
    result = import(csv(*rows), dry_run: true)
    assert result.ok, result.errors.inspect
    assert_equal [ 2, 3, 4, 6 ], result.skipped.map { |s| s[:line] }
    assert_equal 1, result.to_create
  end

  test "DB でも別の文字列（間の空白の有無）は別の本として足す" do
    @other.books.create!(title: "ノルウェイの森", author: "村上春樹")
    result = import(csv([ "ノルウェイの森", "村上 春樹" ]), dry_run: true)
    assert result.ok, result.errors.inspect
    assert_equal 1, result.to_create
    assert_empty result.skipped
  end

  test "全角数字の ISBN も半角にそろえて、同じ ISBN の本として飛ばす" do
    @other.books.create!(title: "ISBN の本", isbn: "9784101010137")
    result = import(csv([ "別の題", nil, nil, nil, nil, nil, nil, nil, "９７８４１０１０１０１３７" ]), dry_run: true)
    assert result.ok, result.errors.inspect
    assert_equal [ 2 ], result.skipped.map { |s| s[:line] }
  end

  test "間違った行が 1 行でもあれば何も登録せず、行番号付きでまとめて知らせる" do
    rows = [
      [ "正しい本" ],
      [ nil, "著者だけ" ],
      [ "本", nil, "読み終わった", "SF", nil, "6", nil, nil, "123", "2026-02-30" ]
    ]
    result = import(csv(*rows))
    assert_not result.ok
    assert_equal 0, @other.books.count
    assert_includes result.errors, "3 行目：タイトルを入力してください"
    assert(result.errors.any? { |e| e.start_with?("4 行目：状態は「読みたい・読書中・読了」") })
    assert(result.errors.any? { |e| e.start_with?("4 行目：ジャンルは") })
    assert_includes result.errors, "4 行目：評価は 1〜5 の数字か空欄にしてください（「6」は使えません）"
    assert(result.errors.any? { |e| e.start_with?("4 行目：登録日は 2026-09-01 の形") })
  end

  test "ISBN の形が正しくない行はモデルの検査で知らせる" do
    result = import(csv([ "本", nil, nil, nil, nil, nil, nil, nil, "9.78427E+12" ]))
    assert_not result.ok
    assert_equal [ "2 行目：ISBNは不正な値です" ], result.errors
  end

  test "見出しにタイトルが無い・本が無い・多すぎる・CSV の形が壊れているときは知らせる" do
    assert_match(/「タイトル」の列が見つかりません/, import("著者\nA\n").errors.first)
    assert_match(/取り込む本がありません/, import(csv).errors.first)
    many = csv(*Array.new(BookCsvImporter::MAX_ROWS + 1) { |i| [ "本#{i}" ] })
    assert_match(/1000 冊まで/, import(many).errors.first)
    assert_match(/CSV ファイルの形が正しくありません/, import("タイトル\n\"閉じない\n").errors.first)
  end

  test "タグに半角・全角の同じ名前が並んでいても、1 つにそろえて取り込む" do
    result = import(csv([ "本", nil, nil, nil, nil, nil, "１、1、ＩＴ" ]))
    assert result.ok, result.errors.inspect
    assert_equal %w[1 IT], @other.books.find_by!(title: "本").tags.map(&:name)
  end

  test "BOM 付き（書き出したそのまま）でも読める" do
    result = import(BookCsvExporter::BOM + csv([ "BOM の本" ]))
    assert result.ok, result.errors.inspect
  end
end
