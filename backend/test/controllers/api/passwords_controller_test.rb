require "test_helper"

module Api
  class PasswordsControllerTest < ActionDispatch::IntegrationTest
    NEW_PASSWORD = "new-password-123".freeze

    setup do
      @owner = users(:owner) # password: "password"
      post api_session_url, params: { email: @owner.email, password: "password" }
    end

    def change_password(current: "password", password: NEW_PASSWORD, confirmation: password)
      patch api_password_url, params: {
        current_password: current, password: password, password_confirmation: confirmation
      }
    end

    test "正しい現在のパスワードで変更でき、新パスワードでのみログインできる" do
      change_password
      assert_response :no_content

      delete api_session_url
      post api_session_url, params: { email: @owner.email, password: "password" }
      assert_response :unauthorized
      post api_session_url, params: { email: @owner.email, password: NEW_PASSWORD }
      assert_response :success
    end

    test "現在のパスワードが違うと 422 で変更されない" do
      change_password(current: "wrong")
      assert_response :unprocessable_content
      assert_equal ["現在のパスワードが違います"], JSON.parse(response.body)["errors"]
      assert @owner.reload.authenticate("password")
    end

    test "新パスワードが 8 文字未満だと 422" do
      change_password(password: "short")
      assert_response :unprocessable_content
      assert_match "8 文字以上", JSON.parse(response.body)["errors"].first
      assert @owner.reload.authenticate("password")
    end

    test "空の新パスワードは 422" do
      change_password(password: "")
      assert_response :unprocessable_content
      assert @owner.reload.authenticate("password")
    end

    test "確認が一致しないと 422" do
      change_password(confirmation: "different-password")
      assert_response :unprocessable_content
      assert_equal ["新しいパスワード（確認）が一致しません"], JSON.parse(response.body)["errors"]
    end

    test "変更すると他端末のセッションは失効し、操作中のセッションは維持される" do
      other_session = @owner.sessions.create!
      change_password
      assert_response :no_content

      assert_not Session.exists?(other_session.id)
      get api_session_url
      assert_response :success
    end

    test "未ログインは 401" do
      delete api_session_url
      change_password
      assert_response :unauthorized
    end
  end
end
