class Tag < ApplicationRecord
  has_many :book_tags, dependent: :destroy
  has_many :books, through: :book_tags

  # タグ名の書き方をそろえる：NFKC（全角英数字 → 半角、半角カナ → 全角、① → 1 など）＋前後の空白を除く。
  # DB の照合順序は半角・全角を同じ名前とみなすので、そろえておかないと入力と違う書き方で表示される
  def self.normalize_name(name)
    name.to_s.unicode_normalize(:nfkc).strip
  end

  # 保存するときだけでなく find_by(name:) / where(name:) の検索でも同じようにそろえる（Rails の normalizes）
  normalizes :name, with: ->(name) { normalize_name(name) }

  validates :name, presence: true, uniqueness: true
end
