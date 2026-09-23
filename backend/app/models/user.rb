class User < ApplicationRecord
  PASSWORD_MIN_LENGTH = 8

  has_secure_password
  has_many :sessions, dependent: :destroy
  has_many :books, dependent: :destroy
  # 自分が発行した招待 / 自分が登録に使った招待
  has_many :issued_invitations, class_name: "Invitation", foreign_key: :inviter_id,
    inverse_of: :inviter, dependent: :destroy
  has_many :used_invitations, class_name: "Invitation", foreign_key: :used_by_id,
    inverse_of: :used_by, dependent: :nullify

  normalizes :email, with: ->(email) { email.to_s.strip.downcase }

  validates :email, presence: true, uniqueness: { case_sensitive: false },
    format: { with: URI::MailTo::EMAIL_REGEXP }
  # 新しく設定するときだけ検証（未変更の更新では password は nil）
  validates :password, length: { minimum: PASSWORD_MIN_LENGTH }, allow_nil: true
end
