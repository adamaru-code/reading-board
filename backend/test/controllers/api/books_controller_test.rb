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

    test "index は genre で絞り込める" do
      target = Book.create!(title: "教養本", genre: :liberal_arts)
      get api_books_url, params: { genre: "liberal_arts" }
      assert_response :success
      ids = JSON.parse(response.body).map { |b| b["id"] }
      assert_includes ids, target.id
      assert_not_includes ids, @book.id # fixture は既定 other
    end

    test "index は不正な genre を無視して全件返す" do
      get api_books_url, params: { genre: "sci_fi" }
      assert_response :success
      assert_equal Book.count, JSON.parse(response.body).size
    end

    test "index は tag（名称）で絞り込める" do
      tagged = Book.create!(title: "名著本", tag_names: ["名著"])
      get api_books_url, params: { tag: "名著" }
      assert_response :success
      ids = JSON.parse(response.body).map { |b| b["id"] }
      assert_equal [tagged.id], ids
    end

    test "index は複数条件を AND で併用できる" do
      hit = Book.create!(title: "hit", status: :reading, genre: :liberal_arts, author: "Ada")
      Book.create!(title: "miss", status: :read, genre: :liberal_arts, author: "Ada")
      get api_books_url, params: { status: "reading", genre: "liberal_arts", author: "Ada" }
      assert_response :success
      assert_equal [hit.id], JSON.parse(response.body).map { |b| b["id"] }
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

    test "create は genre / media_type を保存し、JSON に含む" do
      post api_books_url, params: { book: { title: "雑誌サンプル", genre: "liberal_arts", media_type: "magazine" } }
      assert_response :created
      body = JSON.parse(response.body)
      assert_equal "liberal_arts", body["genre"]
      assert_equal "magazine", body["media_type"]
    end

    test "genre / media_type 未指定なら既定値になる" do
      post api_books_url, params: { book: { title: "既定サンプル" } }
      assert_response :created
      body = JSON.parse(response.body)
      assert_equal "other", body["genre"]
      assert_equal "book", body["media_type"]
    end

    test "create は不正な genre で 422" do
      assert_no_difference "Book.count" do
        post api_books_url, params: { book: { title: "x", genre: "sci_fi" } }
      end
      assert_response :unprocessable_content
    end

    test "create は tags を保存し、JSON に名称配列で含む" do
      post api_books_url, params: { book: { title: "タグ本", tags: ["名著", "入門"] } }
      assert_response :created
      assert_equal %w[名著 入門], JSON.parse(response.body)["tags"]
    end

    test "index / show の JSON は tags を含む" do
      @book.tags << Tag.create!(name: "既読")
      get api_book_url(@book)
      assert_includes JSON.parse(response.body)["tags"], "既読"
    end

    test "update で tags を差し替えられる" do
      @book.update!(tag_names: ["旧"])
      patch api_book_url(@book), params: { book: { tags: ["新A", "新B"] } }
      assert_response :success
      assert_equal %w[新A 新B], @book.reload.tags.map(&:name)
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
