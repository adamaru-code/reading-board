require "test_helper"

module Api
  class PasswordResetsControllerTest < ActionDispatch::IntegrationTest
    NEW_PASSWORD = "reset-password-1".freeze

    setup do
      @other = users(:other) # password: "password"
    end

    def log_in(user, password: "password")
      post api_session_url, params: { email: user.email, password: password }
    end

    def issue_token_as_admin(user = @other)
      log_in(users(:owner))
      post api_user_password_reset_link_url(user)
      token = JSON.parse(response.body)["token"]
      delete api_session_url
      token
    end

    def reset(token, password: NEW_PASSWORD, confirmation: password)
      patch api_password_reset_url, params: {
        token: token, password: password, password_confirmation: confirmation
      }
    end

    def errors = JSON.parse(response.body)["errors"]

    test "管理者は再設定リンクを発行できる（24 時間有効）" do
      log_in(users(:owner))
      post api_user_password_reset_link_url(@other)
      assert_response :created
      body = JSON.parse(response.body)
      assert_equal @other, User.find_by_password_reset_token(body["token"])
      assert_in_delta 24.hours.from_now, Time.zone.parse(body["expires_at"]), 5.seconds
    end

    test "一般ユーザーは発行できず 403、存在しないユーザーは 404" do
      log_in(@other)
      post api_user_password_reset_link_url(users(:owner))
      assert_response :forbidden

      delete api_session_url
      log_in(users(:owner))
      post api_user_password_reset_link_url(user_id: 0)
      assert_response :not_found
    end

    test "リセットすると新パスワードに変わり、既存セッションは失効してログイン状態になる" do
      old_session = @other.sessions.create!
      token = issue_token_as_admin

      reset(token)
      assert_response :success
      assert_equal @other.email, JSON.parse(response.body)["email"]
      assert_not Session.exists?(old_session.id)
      get api_session_url
      assert_response :success # この端末はログイン済み

      delete api_session_url
      log_in(@other)
      assert_response :unauthorized
      log_in(@other, password: NEW_PASSWORD)
      assert_response :success
    end

    test "同じリンクは 2 回使えない" do
      token = issue_token_as_admin
      reset(token)
      assert_response :success

      reset(token, password: "another-password-2")
      assert_response :unprocessable_content
      assert_equal ["再設定リンクが無効か、期限切れです"], errors
    end

    test "24 時間を過ぎたリンク・改ざんしたリンクは 422" do
      token = issue_token_as_admin
      travel 24.hours + 1.second do
        reset(token)
        assert_response :unprocessable_content
        assert_equal ["再設定リンクが無効か、期限切れです"], errors
      end

      reset("#{token}x")
      assert_response :unprocessable_content
      assert @other.reload.authenticate("password")
    end

    test "パスワードが短い・確認が一致しないと 422 で変わらない" do
      token = issue_token_as_admin
      reset(token, password: "short")
      assert_response :unprocessable_content
      assert_equal ["新しいパスワードは 8 文字以上にしてください"], errors

      reset(token, confirmation: "different-password")
      assert_response :unprocessable_content
      assert @other.reload.authenticate("password")
    end

    test "開いた時点でリンクを確認でき、使用済み・改ざんは 422" do
      token = issue_token_as_admin
      get api_password_reset_url, params: { token: token }
      assert_response :success
      assert_equal({ "email" => @other.email }, JSON.parse(response.body))

      reset(token)
      delete api_session_url
      get api_password_reset_url, params: { token: token }
      assert_response :unprocessable_content
      assert_equal ["再設定リンクが無効か、期限切れです"], errors

      get api_password_reset_url, params: { token: "tampered" }
      assert_response :unprocessable_content
    end
  end
end
