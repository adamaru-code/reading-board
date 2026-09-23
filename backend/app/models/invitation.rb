# 招待コード（1 回限り・有効期限付き）。管理者が発行し、登録時に使用済みにする
class Invitation < ApplicationRecord
  CODE_LENGTH = 12
  VALID_FOR = 7.days

  belongs_to :inviter, class_name: "User"
  belongs_to :used_by, class_name: "User", optional: true

  before_validation :assign_defaults, on: :create

  validates :code, presence: true, uniqueness: true
  validates :expires_at, presence: true

  # 未使用かつ期限内（登録に使える）
  scope :usable, -> { where(used_at: nil).where("expires_at > ?", Time.current) }

  def status
    return "used" if used_at
    return "expired" if expires_at <= Time.current

    "unused"
  end

  def redeem!(user)
    update!(used_by: user, used_at: Time.current)
  end

  private

  def assign_defaults
    self.code ||= SecureRandom.base58(CODE_LENGTH)
    self.expires_at ||= VALID_FOR.from_now
  end
end
