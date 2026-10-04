require "test_helper"

module Api
  class TagsControllerTest < ActionDispatch::IntegrationTest
    setup do
      @owner = users(:owner)
      post api_session_url, params: { email: @owner.email, password: "password" }
      @book = @owner.books.create!(title: "タグの本", tag_names: %w[名著])
    end

    test "index は自分のタグと冊数を返す" do
      get api_tags_url
      assert_response :success
      assert_equal [ { "name" => "名著", "count" => 1 } ], JSON.parse(response.body)
    end

    test "rename は付け替えた冊数を返し、断るときは 422" do
      patch rename_api_tags_url, params: { from: "名著", to: "おすすめ" }, as: :json
      assert_response :success
      assert_equal({ "count" => 1, "merged" => false }, JSON.parse(response.body))
      assert_equal %w[おすすめ], @book.reload.tags.map(&:name)

      patch rename_api_tags_url, params: { from: "おすすめ", to: "" }, as: :json
      assert_response :unprocessable_content
      assert_equal [ "新しい名前を入力してください" ], JSON.parse(response.body)["errors"]
    end

    test "remove は外した冊数を返す" do
      delete remove_api_tags_url, params: { name: "名著" }
      assert_response :success
      assert_equal 1, JSON.parse(response.body)["count"]
      assert_empty @book.reload.tags
    end

    test "未ログインは 401" do
      delete api_session_url
      get api_tags_url
      assert_response :unauthorized
    end
  end
end
