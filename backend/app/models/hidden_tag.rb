# タグ候補から隠したタグ名（ユーザーごと）。本に付いているタグには影響しない
class HiddenTag < ApplicationRecord
  belongs_to :user

  normalizes :name, with: ->(name) { name.to_s.strip }

  validates :name, presence: true, length: { maximum: 255 }, uniqueness: { scope: :user_id }
end
