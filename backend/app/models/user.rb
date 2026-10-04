class User < ApplicationRecord
  PASSWORD_MIN_LENGTH = 8
  # 管理者が発行する再設定リンクの有効期限（手で渡すため Rails 既定の 15 分より長め）
  PASSWORD_RESET_VALID_FOR = 24.hours

  # reset_token：署名付きトークン（DB 保存なし）。パスワードを変えると無効になるので 1 回限り
  has_secure_password reset_token: { expires_in: PASSWORD_RESET_VALID_FOR }
  has_many :sessions, dependent: :destroy
  has_many :books, dependent: :destroy
  has_many :hidden_tags, dependent: :destroy
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

  # タグ候補から隠したタグのうち、自分の本でもう使われていない名前を消す（本の削除・タグの付け替え・外したあと）。
  # 自分のほかの本にまだ付いているタグは残す。辞書・定番タグにもある名前は再び候補に出る
  def forget_hidden_tags_no_longer_used(tag_names)
    return if tag_names.empty?

    still_used = Tag.joins(:books).where(name: tag_names, books: { user_id: id }).distinct.pluck(:name)
    hidden_tags.where(name: tag_names - still_used).delete_all
  end
end
