require "test_helper"

class InvitationTest < ActiveSupport::TestCase
  setup do
    @owner = users(:owner)
  end

  test "作成時にコードと 7 日後の期限を付ける" do
    invitation = @owner.issued_invitations.create!
    assert_equal Invitation::CODE_LENGTH, invitation.code.length
    assert_in_delta 7.days.from_now, invitation.expires_at, 5.seconds
    assert_equal "unused", invitation.status
  end

  test "status は使用済み・期限切れを返し、usable はどちらも含まない" do
    used = @owner.issued_invitations.create!
    used.redeem!(users(:other))
    expired = @owner.issued_invitations.create!(expires_at: 1.minute.ago)
    unused = @owner.issued_invitations.create!

    assert_equal "used", used.status
    assert_equal "expired", expired.status
    assert_equal [unused], Invitation.usable.to_a
  end
end
