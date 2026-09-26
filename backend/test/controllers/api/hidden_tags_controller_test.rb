require "test_helper"

module Api
  class HiddenTagsControllerTest < ActionDispatch::IntegrationTest
    setup do
      @owner = users(:owner)
      post api_session_url, params: { email: @owner.email, password: "password" }
    end

    def body = JSON.parse(response.body)

    test "隠したタグを登録でき、一覧に名前順で出る" do
      post api_hidden_tags_url, params: { name: " 積読 " }
      assert_response :created
      assert_equal "積読", body["name"]
      post api_hidden_tags_url, params: { name: "名著" }

      get api_hidden_tags_url
      assert_response :success
      assert_equal %w[名著 積読].sort, body.map { |t| t["name"] }
    end

    test "同じタグを 2 回隠しても 1 件のまま（200 で同じものを返す）" do
      post api_hidden_tags_url, params: { name: "積読" }
      first_id = body["id"]
      assert_no_difference -> { HiddenTag.count } do
        post api_hidden_tags_url, params: { name: "積読" }
      end
      assert_response :success
      assert_equal first_id, body["id"]
    end

    test "空の名前は 422" do
      post api_hidden_tags_url, params: { name: "  " }
      assert_response :unprocessable_content
    end

    test "戻す（削除）と一覧から消え、本のタグには影響しない" do
      book = @owner.books.create!(title: "本", tag_names: [ "積読" ])
      post api_hidden_tags_url, params: { name: "積読" }
      delete api_hidden_tag_url(body["id"])
      assert_response :no_content

      get api_hidden_tags_url
      assert_equal [], body
      assert_equal [ "積読" ], book.reload.tag_names
    end

    test "他のユーザーの隠したタグは見えず、戻せない（404）" do
      others = users(:other).hidden_tags.create!(name: "他人のタグ")
      get api_hidden_tags_url
      assert_equal [], body
      delete api_hidden_tag_url(others)
      assert_response :not_found
      assert HiddenTag.exists?(others.id)
    end

    test "未ログインは 401" do
      delete api_session_url
      get api_hidden_tags_url
      assert_response :unauthorized
    end
  end
end
