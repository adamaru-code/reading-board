require "test_helper"

module Api
  class InvitationsControllerTest < ActionDispatch::IntegrationTest
    def log_in(user)
      post api_session_url, params: { email: user.email, password: "password" }
    end

    setup do
      @owner = users(:owner) # 管理者
    end

    test "管理者は招待を発行できる" do
      log_in(@owner)
      assert_difference -> { @owner.issued_invitations.count }, 1 do
        post api_invitations_url
      end
      assert_response :created
      body = JSON.parse(response.body)
      assert_equal "unused", body["status"]
      assert_equal Invitation::CODE_LENGTH, body["code"].length
    end

    test "一覧は自分が発行した招待を新しい順で、使った人のメールを含む" do
      log_in(@owner)
      old = @owner.issued_invitations.create!(created_at: 1.day.ago)
      old.redeem!(users(:other))
      recent = @owner.issued_invitations.create!

      get api_invitations_url
      assert_response :success
      body = JSON.parse(response.body)
      assert_equal [recent.id, old.id], body.map { |i| i["id"] }
      assert_equal "other@example.com", body.last["used_by_email"]
      assert_equal "used", body.last["status"]
    end

    test "未使用の招待は削除できる" do
      log_in(@owner)
      invitation = @owner.issued_invitations.create!
      delete api_invitation_url(invitation)
      assert_response :no_content
      assert_not Invitation.exists?(invitation.id)
    end

    test "使用済みの招待は削除できない" do
      log_in(@owner)
      invitation = @owner.issued_invitations.create!
      invitation.redeem!(users(:other))
      delete api_invitation_url(invitation)
      assert_response :unprocessable_content
      assert Invitation.exists?(invitation.id)
    end

    test "一般ユーザーは 403" do
      log_in(users(:other))
      get api_invitations_url
      assert_response :forbidden
      post api_invitations_url
      assert_response :forbidden
    end

    test "未ログインは 401" do
      get api_invitations_url
      assert_response :unauthorized
    end
  end
end
