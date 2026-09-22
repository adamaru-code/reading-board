require "test_helper"

module Api
  class SessionsControllerTest < ActionDispatch::IntegrationTest
    setup do
      @owner = users(:owner) # password: "password"
    end

    test "正しい資格情報でログインでき、ユーザーを返す" do
      post api_session_url, params: { email: @owner.email, password: "password" }
      assert_response :success
      assert_equal @owner.email, JSON.parse(response.body)["email"]
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
  end
end
