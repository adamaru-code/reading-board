module Api
  class BooksController < ApplicationController
    rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
    # 不正な status（enum に無い値）の代入は ArgumentError になるため 422 で返す
    rescue_from ArgumentError, with: :render_bad_argument

    # GET /api/books
    # status（enum キー）・author（部分一致）で絞り込める。併用は AND。
    def index
      books = Book.includes(:tags, :status_events) # タグ・日付の N+1 を回避
      books = books.where(status: params[:status]) if valid_status?(params[:status])
      books = books.where(genre: params[:genre]) if valid_genre?(params[:genre])
      books = books.where("author LIKE ?", "%#{params[:author]}%") if params[:author].present?
      # タグは名称で完全一致。includes と二重 JOIN しないよう id サブクエリで絞る
      if params[:tag].present?
        books = books.where(id: Book.joins(:tags).where(tags: { name: params[:tag] }))
      end
      # position 昇順（未設定は後ろ）→ created_at
      books = books.order(Arel.sql("position IS NULL, position ASC, created_at ASC"))
      render json: books.map { |book| book_json(book) }
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
        return render json: { errors: ["ISBN が不正です"] }, status: :unprocessable_content
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
      book = Book.new(book_params)
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
    # 渡された id 順に position を 0..n-1 で保存（カラム内の並び順）
    def reorder
      ids = Array(params[:ids]).map(&:to_i)
      Book.transaction do
        ids.each_with_index do |id, index|
          Book.where(id: id).update_all(position: index)
        end
      end
      head :no_content
    end

    private

    def find_book
      Book.find(params[:id])
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
      render json: { errors: ["Book not found"] }, status: :not_found
    end

    def render_bad_argument(error)
      render json: { errors: [error.message] }, status: :unprocessable_content
    end
  end
end
