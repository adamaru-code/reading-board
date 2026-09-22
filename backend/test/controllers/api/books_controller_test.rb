require "test_helper"

module Api
  class BooksControllerTest < ActionDispatch::IntegrationTest
    setup do
      @owner = users(:owner)
      @book = books(:readable_code) # owner の本（status: reading, author: Dustin Boswell）
      # 以降のリクエストは owner でログイン済み（Cookie がテスト内で維持される）
      post api_session_url, params: { email: @owner.email, password: "password" }
    end

    test "index は items とページ情報を返す" do
      get api_books_url
      assert_response :success
      body = JSON.parse(response.body)
      assert_equal Book.count, body["items"].size
      assert body["items"].first.key?("status")
      assert_equal Book.count, body["pagination"]["total"]
      assert_equal 1, body["pagination"]["page"]
    end

    test "index は status で絞り込める" do
      get api_books_url, params: { status: "reading" }
      assert_response :success
      items = JSON.parse(response.body)["items"]
      assert items.all? { |b| b["status"] == "reading" }
      assert_includes items.map { |b| b["id"] }, @book.id
    end

    test "index は不正な status を無視して全件返す" do
      get api_books_url, params: { status: "unknown" }
      assert_response :success
      assert_equal Book.count, JSON.parse(response.body)["items"].size
    end

    test "index は author の部分一致で絞り込める" do
      get api_books_url, params: { author: "Boswell" }
      assert_response :success
      items = JSON.parse(response.body)["items"]
      assert_equal [@book.id], items.map { |b| b["id"] }
    end

    test "index は genre で絞り込める" do
      target = @owner.books.create!(title: "教養本", genre: :liberal_arts)
      get api_books_url, params: { genre: "liberal_arts" }
      assert_response :success
      ids = JSON.parse(response.body)["items"].map { |b| b["id"] }
      assert_includes ids, target.id
      assert_not_includes ids, @book.id # fixture は既定 other
    end

    test "index は不正な genre を無視して全件返す" do
      get api_books_url, params: { genre: "sci_fi" }
      assert_response :success
      assert_equal Book.count, JSON.parse(response.body)["items"].size
    end

    test "index は tag（名称）で絞り込める" do
      tagged = @owner.books.create!(title: "名著本", tag_names: ["名著"])
      get api_books_url, params: { tag: "名著" }
      assert_response :success
      ids = JSON.parse(response.body)["items"].map { |b| b["id"] }
      assert_equal [tagged.id], ids
    end

    test "index は複数条件を AND で併用できる" do
      hit = @owner.books.create!(title: "hit", status: :reading, genre: :liberal_arts, author: "Ada")
      @owner.books.create!(title: "miss", status: :read, genre: :liberal_arts, author: "Ada")
      get api_books_url, params: { status: "reading", genre: "liberal_arts", author: "Ada" }
      assert_response :success
      assert_equal [hit.id], JSON.parse(response.body)["items"].map { |b| b["id"] }
    end

    test "index は per_page と page で分割し total を返す" do
      Book.delete_all
      5.times { |i| @owner.books.create!(title: "本#{i}") }
      get api_books_url, params: { per_page: 2, page: 1 }
      body = JSON.parse(response.body)
      assert_equal 2, body["items"].size
      assert_equal 5, body["pagination"]["total"]
      assert_equal 3, body["pagination"]["total_pages"]

      get api_books_url, params: { per_page: 2, page: 3 }
      assert_equal 1, JSON.parse(response.body)["items"].size # 最終ページは端数
    end

    test "index は per_page 上限クランプ・page 下限1にする" do
      get api_books_url, params: { per_page: 9999, page: 0 }
      pagination = JSON.parse(response.body)["pagination"]
      assert_equal 200, pagination["per_page"]
      assert_equal 1, pagination["page"]
    end

    test "index は他ユーザーの本を含まない（所有者スコープ）" do
      others = users(:other).books.create!(title: "他人の本")
      get api_books_url
      ids = JSON.parse(response.body)["items"].map { |b| b["id"] }
      assert_not_includes ids, others.id
    end

    test "show は他ユーザーの本だと 404" do
      others = users(:other).books.create!(title: "他人の本")
      get api_book_url(others)
      assert_response :not_found
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

    test "JSON は導出日付フィールドを含み、作成した状態の日付が入る" do
      post api_books_url, params: { book: { title: "d", status: "reading" } }
      assert_response :created
      body = JSON.parse(response.body)
      assert body.key?("started_on")
      assert body.key?("duration_days")
      assert_equal Date.current.to_s, body["started_on"]
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

    # 外部 API（openBD）の呼び出しをブロック内だけ固定値に差し替える
    def stub_openbd_fetch(result)
      original = OpenbdClient.method(:fetch)
      OpenbdClient.define_singleton_method(:fetch) { |*| result }
      yield
    ensure
      OpenbdClient.define_singleton_method(:fetch, original)
    end

    test "lookup は openBD の結果と形態判定を返す" do
      stub_openbd_fetch({ title: "リーダブルコード", author: "Dustin Boswell" }) do
        get lookup_api_books_url, params: { isbn: "978-4-87311-565-8" }
      end
      assert_response :success
      body = JSON.parse(response.body)
      assert_equal "9784873115658", body["isbn"]
      assert_equal true, body["found"]
      assert_equal "リーダブルコード", body["title"]
      assert_equal "book", body["media_type"]
    end

    test "lookup は該当なしでも found:false と形態判定を返す（雑誌）" do
      stub_openbd_fetch(nil) do
        get lookup_api_books_url, params: { isbn: "4910000000000" }
      end
      assert_response :success
      body = JSON.parse(response.body)
      assert_equal false, body["found"]
      assert_nil body["title"]
      assert_equal "magazine", body["media_type"]
    end

    test "lookup は不正な ISBN で 422" do
      get lookup_api_books_url, params: { isbn: "123" }
      assert_response :unprocessable_content
    end

    test "reorder は渡した id 順に position を保存する" do
      a = @owner.books.create!(title: "A")
      b = @owner.books.create!(title: "B")
      c = @owner.books.create!(title: "C")
      patch reorder_api_books_url, params: { ids: [c.id, a.id, b.id] }
      assert_response :no_content
      assert_equal 0, c.reload.position
      assert_equal 1, a.reload.position
      assert_equal 2, b.reload.position
    end

    test "index は position 昇順（未設定は後ろ）で返る" do
      Book.delete_all
      old = @owner.books.create!(title: "古い未設定")
      a = @owner.books.create!(title: "後で1番")
      b = @owner.books.create!(title: "後で2番")
      patch reorder_api_books_url, params: { ids: [b.id, a.id] }
      get api_books_url
      ids = JSON.parse(response.body)["items"].map { |x| x["id"] }
      assert_equal [b.id, a.id, old.id], ids # position 付き→未設定の順
    end
  end
end
