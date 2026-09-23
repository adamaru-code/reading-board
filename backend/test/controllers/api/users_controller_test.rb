require "test_helper"

module Api
  class UsersControllerTest < ActionDispatch::IntegrationTest
    def log_in(user) = post(api_session_url, params: { email: user.email, password: "password" })

    test "管理者はユーザー一覧を取れる" do
      log_in(users(:owner))
      get api_users_url
      assert_response :success
      body = JSON.parse(response.body)
      assert_equal User.count, body.size
      assert_equal %w[admin created_at email id], body.first.keys.sort
    end

    test "一般ユーザーは 403" do
      log_in(users(:other))
      get api_users_url
      assert_response :forbidden
    end
  end
end
