class User < ApplicationRecord
  PASSWORD_MIN_LENGTH = 8

  has_secure_password
  has_many :sessions, dependent: :destroy
  has_many :books, dependent: :destroy

  normalizes :email, with: ->(email) { email.to_s.strip.downcase }

  validates :email, presence: true, uniqueness: { case_sensitive: false }
  # 新しく設定するときだけ検証（未変更の更新では password は nil）
  validates :password, length: { minimum: PASSWORD_MIN_LENGTH }, allow_nil: true
end
