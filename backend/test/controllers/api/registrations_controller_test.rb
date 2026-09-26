require "test_helper"

module Api
  class RegistrationsControllerTest < ActionDispatch::IntegrationTest
    setup do
      @invitation = users(:owner).issued_invitations.create!
    end

    def register(code: @invitation.code, email: "new@example.com", password: "new-password-1", confirmation: password)
      post api_registration_url, params: {
        invitation_code: code, email: email, password: password, password_confirmation: confirmation
      }
    end

    def errors = JSON.parse(response.body)["errors"]

    test "正しい招待コードで登録でき、ログイン状態になり、本は空" do
      assert_difference -> { User.count }, 1 do
        register
      end
      assert_response :created
      assert_equal({ "email" => "new@example.com", "admin" => false },
        JSON.parse(response.body).slice("email", "admin"))

      new_user = User.find_by!(email: "new@example.com")
      assert_equal new_user, @invitation.reload.used_by
      assert_not_nil @invitation.used_at

      get api_session_url
      assert_response :success
      get api_books_url
      assert_equal [], JSON.parse(response.body)["items"] # 他人の本は見えない
    end

    test "同じ招待コードは 2 回使えない" do
      register
      delete api_session_url
      assert_no_difference -> { User.count } do
        register(email: "second@example.com")
      end
      assert_response :unprocessable_content
      assert_equal [ "招待コードが無効です" ], errors
    end

    test "存在しない・期限切れのコードは 422" do
      register(code: "unknown-code")
      assert_response :unprocessable_content
      assert_equal [ "招待コードが無効です" ], errors

      @invitation.update!(expires_at: 1.minute.ago)
      register
      assert_response :unprocessable_content
      assert_equal [ "招待コードが無効です" ], errors
    end

    test "メールが登録済みなら 422 で、招待は未使用のまま" do
      register(email: "OWNER@example.com")
      assert_response :unprocessable_content
      assert_equal [ "このメールアドレスは登録済みです" ], errors
      assert_nil @invitation.reload.used_at
    end

    test "メール形式が不正なら 422" do
      register(email: "not-an-email")
      assert_response :unprocessable_content
      assert_equal [ "メールアドレスの形式が正しくありません" ], errors
    end

    test "パスワードが短い・確認が一致しないと 422" do
      register(password: "short")
      assert_response :unprocessable_content
      assert_equal [ "パスワードは 8 文字以上にしてください" ], errors

      register(confirmation: "different-password")
      assert_response :unprocessable_content
      assert_equal [ "パスワード（確認）が一致しません" ], errors
      assert_nil @invitation.reload.used_at
    end

    test "登録の試行が 1 時間に 10 回を超えると 429（招待コードの総当たり対策）" do
      10.times { |n| register(code: "guess-#{n}") }
      assert_response :unprocessable_content
      register
      assert_response :too_many_requests
      assert_nil @invitation.reload.used_at
    end

    def log_in(user) = post(api_session_url, params: { email: user.email, password: "password" })

    test "アカウント削除で本・セッションが消え、使った招待は残って used_by が NULL になる" do
      other = users(:other)
      other.books.create!(title: "消える本")
      @invitation.redeem!(other)
      log_in(other)

      assert_difference -> { User.count } => -1, -> { Book.where(user: other).count } => -1 do
        delete api_registration_url, params: { current_password: "password" }
      end
      assert_response :no_content
      assert_nil @invitation.reload.used_by_id
      assert_equal 0, Session.where(user_id: other.id).count
      get api_session_url
      assert_response :unauthorized
    end

    test "アカウント削除は現在のパスワードが違うと 422" do
      log_in(users(:other))
      delete api_registration_url, params: { current_password: "wrong" }
      assert_response :unprocessable_content
      assert_equal [ "現在のパスワードが違います" ], errors
      assert User.exists?(users(:other).id)
    end

    test "最後の管理者は削除できないが、他に管理者がいれば削除できる" do
      owner = users(:owner)
      log_in(owner)
      delete api_registration_url, params: { current_password: "password" }
      assert_response :unprocessable_content
      assert_equal [ "最後の管理者は削除できません" ], errors

      users(:other).update!(admin: true)
      delete api_registration_url, params: { current_password: "password" }
      assert_response :no_content
      assert_not User.exists?(owner.id)
      assert_not Invitation.exists?(@invitation.id) # 発行した招待も消える
    end

    test "アカウント削除は未ログインで 401" do
      delete api_registration_url, params: { current_password: "password" }
      assert_response :unauthorized
    end
  end
end
