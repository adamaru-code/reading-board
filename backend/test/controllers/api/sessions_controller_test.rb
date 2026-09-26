require "test_helper"

module Api
  class SessionsControllerTest < ActionDispatch::IntegrationTest
    setup do
      @owner = users(:owner) # password: "password"
    end

    test "正しい資格情報でログインでき、ユーザー（管理者フラグ付き）を返す" do
      post api_session_url, params: { email: @owner.email, password: "password" }
      assert_response :success
      body = JSON.parse(response.body)
      assert_equal @owner.email, body["email"]
      assert_equal true, body["admin"]
    end

    test "誤ったパスワードは 401" do
      post api_session_url, params: { email: @owner.email, password: "wrong" }
      assert_response :unauthorized
    end

    test "存在しないメールは 401" do
      post api_session_url, params: { email: "nobody@example.com", password: "password" }
      assert_response :unauthorized
    end

    test "show はログイン中のユーザーを返す" do
      post api_session_url, params: { email: @owner.email, password: "password" }
      get api_session_url
      assert_response :success
      assert_equal @owner.email, JSON.parse(response.body)["email"]
    end

    test "未ログインで show は 401" do
      get api_session_url
      assert_response :unauthorized
    end

    test "ログアウトするとセッションが無効になる" do
      post api_session_url, params: { email: @owner.email, password: "password" }
      delete api_session_url
      assert_response :no_content
      get api_session_url
      assert_response :unauthorized
    end

    test "未ログインで books は 401" do
      get api_books_url
      assert_response :unauthorized
    end

    test "ログイン試行が 3 分に 10 回を超えると 429" do
      10.times { post api_session_url, params: { email: @owner.email, password: "wrong" } }
      assert_response :unauthorized
      post api_session_url, params: { email: @owner.email, password: "password" }
      assert_response :too_many_requests
      assert_equal [ AttemptLimiting::TOO_MANY_ATTEMPTS ], JSON.parse(response.body)["errors"]

      travel 3.minutes + 1.second do
        post api_session_url, params: { email: @owner.email, password: "password" }
        assert_response :success
      end
    end
  end
end
