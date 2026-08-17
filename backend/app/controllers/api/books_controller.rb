module Api
  class BooksController < ApplicationController
    rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
    # 不正な status（enum に無い値）の代入は ArgumentError になるため 422 で返す
    rescue_from ArgumentError, with: :render_bad_argument

    # GET /api/books
    # status（enum キー）・author（部分一致）で絞り込める。併用は AND。
    def index
      books = Book.all
      books = books.where(status: params[:status]) if valid_status?(params[:status])
      books = books.where("author LIKE ?", "%#{params[:author]}%") if params[:author].present?
      books = books.order(:position, :created_at)
      render json: books.map { |book| book_json(book) }
    end

    # GET /api/books/:id
    def show
      render json: book_json(find_book)
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

    private

    def find_book
      Book.find(params[:id])
    end

    def book_params
      params.require(:book).permit(:title, :author, :status, :rating, :memo, :position)
    end

    # enum に存在するキーのみ絞り込み条件に使う（不正値は無視）
    def valid_status?(status)
      status.present? && Book.statuses.key?(status)
    end

    def book_json(book)
      {
        id: book.id,
        title: book.title,
        author: book.author,
        status: book.status,
        rating: book.rating,
        memo: book.memo,
        position: book.position,
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
