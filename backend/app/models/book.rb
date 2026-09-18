class Book < ApplicationRecord
  # カンバンのカラムに対応する状態（読みたい / 読書中 / 読了）
  enum :status, { want_to_read: 0, reading: 1, read: 2 }

  # 主ジャンル（単一）。詳細は docs/database-design.md §3
  enum :genre, { classic_novel: 0, liberal_arts: 1, health_body: 2, practical: 3, other: 4 }, default: :other

  # 形態（書籍 / 雑誌）。値名 book が scope 名と紛らわしいため prefix を付ける
  enum :media_type, { book: 0, magazine: 1 }, default: :book, prefix: :media

  # タグ（多対多）。API とは名称配列でやり取りする
  has_many :book_tags, dependent: :destroy
  has_many :tags, through: :book_tags

  validates :title, presence: true, length: { maximum: 255 }
  validates :rating, inclusion: { in: 0..5 }, allow_nil: true

  # tags: string[] を受け取り、正規化して find_or_create で紐づける
  def tag_names=(names)
    cleaned = Array(names).map { |name| name.to_s.strip }.reject(&:blank?).uniq
    self.tags = cleaned.map { |name| Tag.find_or_create_by(name: name) }
  end

  def tag_names
    tags.map(&:name)
  end
end
