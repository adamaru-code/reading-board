# タグ候補から隠したタグ名（ユーザーごと）。本に付いているタグには影響しない
class HiddenTag < ApplicationRecord
  belongs_to :user

  # 本のタグと同じ書き方にそろえる（Tag.normalize_name）
  normalizes :name, with: ->(name) { Tag.normalize_name(name) }

  validates :name, presence: true, length: { maximum: 255 }, uniqueness: { scope: :user_id }
end
