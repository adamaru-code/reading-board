require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "パスワードは 8 文字以上" do
    user = users(:owner)
    user.password = "short"
    assert_not user.valid?
    user.password = "long-enough"
    assert user.valid?
  end

  test "パスワードを変更しない更新では長さを検証しない" do
    assert users(:owner).update(email: "renamed@example.com")
  end
end
