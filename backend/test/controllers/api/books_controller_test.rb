require "test_helper"

module Api
  class BooksControllerTest < ActionDispatch::IntegrationTest
    setup do
      @book = books(:readable_code) # status: reading, author: Dustin Boswell
    end

    test "index は全件を JSON で返す" do
      get api_books_url
      assert_response :success
      body = JSON.parse(response.body)
      assert_equal Book.count, body.size
      assert body.first.key?("status")
    end

    test "index は status で絞り込める" do
      get api_books_url, params: { status: "reading" }
      assert_response :success
      body = JSON.parse(response.body)
      assert body.all? { |b| b["status"] == "reading" }
      assert_includes body.map { |b| b["id"] }, @book.id
    end

    test "index は不正な status を無視して全件返す" do
      get api_books_url, params: { status: "unknown" }
      assert_response :success
      assert_equal Book.count, JSON.parse(response.body).size
    end

    test "index は author の部分一致で絞り込める" do
      get api_books_url, params: { author: "Boswell" }
      assert_response :success
      body = JSON.parse(response.body)
      assert_equal [@book.id], body.map { |b| b["id"] }
    end

    test "show は書籍を返す" do
      get api_book_url(@book)
      assert_response :success
      assert_equal @book.title, JSON.parse(response.body)["title"]
    end

    test "show は存在しない id で 404" do
      get api_book_url(id: 0)
      assert_response :not_found
    end

    test "create は書籍を作成して 201" do
      assert_difference "Book.count", 1 do
        post api_books_url, params: { book: { title: "新しい本", status: "want_to_read" } }
      end
      assert_response :created
      assert_equal "新しい本", JSON.parse(response.body)["title"]
    end

    test "create は title 無しで 422" do
      assert_no_difference "Book.count" do
        post api_books_url, params: { book: { title: "" } }
      end
      assert_response :unprocessable_content
      assert JSON.parse(response.body)["errors"].present?
    end

    test "create は不正な status で 422" do
      assert_no_difference "Book.count" do
        post api_books_url, params: { book: { title: "x", status: "flying" } }
      end
      assert_response :unprocessable_content
    end

    test "update は属性を更新する" do
      patch api_book_url(@book), params: { book: { status: "read", rating: 5 } }
      assert_response :success
      @book.reload
      assert_equal "read", @book.status
      assert_equal 5, @book.rating
    end

    test "update は不正値で 422" do
      patch api_book_url(@book), params: { book: { rating: 99 } }
      assert_response :unprocessable_content
    end

    test "destroy は書籍を削除して 204" do
      assert_difference "Book.count", -1 do
        delete api_book_url(@book)
      end
      assert_response :no_content
    end
  end
end
