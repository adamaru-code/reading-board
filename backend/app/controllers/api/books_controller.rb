module Api
  class BooksController < ApplicationController
    rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
    # 不正な status（enum に無い値）の代入は ArgumentError になるため 422 で返す
    rescue_from ArgumentError, with: :render_bad_argument

    # 既定の並び：position 昇順（未設定は後ろ）→ created_at → id（ページ境界を安定させる）
    DEFAULT_ORDER = "position IS NULL, position ASC, created_at ASC, id ASC".freeze

    # 各状態に「最初に入った日」（Book#registered_on 等と同じ定義）の SQL
    def self.first_occurred_on_sql(status)
      "(SELECT MIN(e.occurred_on) FROM book_status_events e " \
        "WHERE e.book_id = books.id AND e.status = #{Book.statuses.fetch(status)})"
    end

    # sort パラメータ → 並び替え式（値が無い本は常に末尾、同値はタイトル順）
    SORT_EXPRESSIONS = {
      "registered_on" => first_occurred_on_sql("want_to_read"),
      "finished_on" => first_occurred_on_sql("read"),
      "rating" => "rating",
      "duration_days" => "DATEDIFF(#{first_occurred_on_sql('read')}, #{first_occurred_on_sql('reading')})"
    }.freeze

    # GET /api/books
    # status（enum キー）・author（部分一致）で絞り込める。併用は AND。
    # sort（SORT_EXPRESSIONS のキー）/ dir（asc|desc）で並び替え、page または offset ＋ per_page で分割する。
    def index
      books = current_user.books.includes(:tags, :status_events) # 所有者スコープ＋N+1 回避
      books = books.where(status: params[:status]) if valid_status?(params[:status])
      books = books.where(genre: params[:genre]) if valid_genre?(params[:genre])
      books = books.where("author LIKE ?", "%#{params[:author]}%") if params[:author].present?
      # タグは名称で完全一致。includes と二重 JOIN しないよう id サブクエリで絞る
      if params[:tag].present?
        books = books.where(id: Book.joins(:tags).where(tags: { name: params[:tag] }))
      end
      total = books.count
      per_page = pagination_per_page
      offset = pagination_offset(per_page)
      items = books.order(Arel.sql(order_clause)).limit(per_page).offset(offset)

      render json: {
        items: items.map { |book| book_json(book) },
        pagination: {
          page: (offset / per_page) + 1,
          per_page: per_page,
          total: total,
          total_pages: total.zero? ? 0 : (total.to_f / per_page).ceil
        }
      }
    end

    # GET /api/books/:id
    def show
      render json: book_json(find_book)
    end

    # GET /api/books/lookup?isbn=
    # openBD を照会し、フォーム自動入力用に書誌情報を返す
    def lookup
      isbn = OpenbdClient.normalize(params[:isbn])
      unless OpenbdClient.valid?(isbn)
        return render json: { errors: [ "ISBN が不正です" ] }, status: :unprocessable_content
      end

      info = OpenbdClient.fetch(isbn)
      render json: {
        isbn: isbn,
        found: info.present?,
        title: info && info[:title],
        author: info && info[:author],
        media_type: OpenbdClient.media_type_for(isbn)
      }
    end

    # POST /api/books
    def create
      book = current_user.books.new(book_params)
      if book.save
        render json: book_json(book), status: :created
      else
        render_unprocessable(book)
      end
    end

    # PATCH/PUT /api/books/:id
    def update
      book = find_book
      if book.update(book_params)
        render json: book_json(book)
      else
        render_unprocessable(book)
      end
    end

    # DELETE /api/books/:id
    def destroy
      find_book.destroy
      head :no_content
    end

    # PATCH /api/books/reorder
    # 渡された id 順に position を 0..n-1 で保存（カラム内の並び順）。
    # フロントはページングで読み込み済みの分しか送れないため、同じ status の残りの本は
    # 既存の並びのまま n.. に詰める（位置の重複で順序が崩れないように）
    def reorder
      ids = Array(params[:ids]).map(&:to_i).uniq
      return head :no_content if ids.empty?

      books = current_user.books
      statuses = books.where(id: ids).distinct.pluck(:status)
      rest_ids =
        if statuses.one?
          books.where(status: statuses.first).where.not(id: ids).order(Arel.sql(DEFAULT_ORDER)).pluck(:id)
        else
          []
        end
      ordered = ids + rest_ids

      # id → position を CASE 式で 1 クエリ更新（所有者スコープ）。
      # SQL を文字列で組み立てず Arel で作る（値は Arel がクォートする）
      position_case = Arel::Nodes::Case.new(Book.arel_table[:id])
      ordered.each_with_index { |id, index| position_case.when(id).then(index) }
      books.where(id: ordered).update_all(position: position_case)
      head :no_content
    end

    private

    def find_book
      current_user.books.find(params[:id])
    end

    def book_params
      permitted = params.require(:book).permit(
        :title, :author, :status, :rating, :memo, :position, :genre, :media_type, tags: []
      )
      # API の tags(名称配列) はモデルの tag_names= で受ける
      permitted[:tag_names] = permitted.delete(:tags) if permitted.key?(:tags)
      permitted
    end

    # enum に存在するキーのみ絞り込み条件に使う（不正値は無視）
    def valid_status?(status)
      status.present? && Book.statuses.key?(status)
    end

    def valid_genre?(genre)
      genre.present? && Book.genres.key?(genre)
    end

    # 取得開始位置。offset（0 以上）があれば優先し、無ければ page（1 以上）から求める。
    # offset はカード移動で件数がずれた後の「もっと見る」に使う
    def pagination_offset(per_page)
      return [ params[:offset].to_i, 0 ].max if params[:offset].present?

      ([ params[:page].to_i, 1 ].max - 1) * per_page
    end

    # sort 指定があればその式（値なしは末尾）→ 同値はタイトル順。
    # キーで並べる場合は手動順（position）を混ぜない（読了カラムは手動並び替えの対象外）
    def order_clause
      expression = SORT_EXPRESSIONS[params[:sort]]
      return DEFAULT_ORDER unless expression

      direction = params[:dir] == "desc" ? "DESC" : "ASC"
      "#{expression} IS NULL, #{expression} #{direction}, title ASC, id ASC"
    end

    # 1 ページ件数（既定 100・1〜200 にクランプ）
    def pagination_per_page
      requested = params[:per_page].presence&.to_i || 100
      requested.clamp(1, 200)
    end

    def book_json(book)
      {
        id: book.id,
        title: book.title,
        author: book.author,
        status: book.status,
        genre: book.genre,
        media_type: book.media_type,
        rating: book.rating,
        memo: book.memo,
        position: book.position,
        tags: book.tags.map(&:name),
        registered_on: book.registered_on,
        started_on: book.started_on,
        finished_on: book.finished_on,
        duration_days: book.duration_days,
        created_at: book.created_at,
        updated_at: book.updated_at
      }
    end

    def render_unprocessable(book)
      render json: { errors: book.errors.full_messages }, status: :unprocessable_content
    end

    def render_not_found
      render json: { errors: [ "Book not found" ] }, status: :not_found
    end

    def render_bad_argument(error)
      render json: { errors: [ error.message ] }, status: :unprocessable_content
    end
  end
end
