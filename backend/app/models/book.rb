class Book < ApplicationRecord
  # カンバンのカラムに対応する状態（読みたい / 読書中 / 読了）
  enum :status, { want_to_read: 0, reading: 1, read: 2 }

  # 主ジャンル（単一）。詳細は docs/database-design.md §3
  enum :genre, { classic_novel: 0, liberal_arts: 1, health_body: 2, practical: 3, other: 4 }, default: :other

  # 形態（書籍 / 雑誌）。値名 book が scope 名と紛らわしいため prefix を付ける
  enum :media_type, { book: 0, magazine: 1 }, default: :book, prefix: :media

  validates :title, presence: true, length: { maximum: 255 }
  validates :rating, inclusion: { in: 0..5 }, allow_nil: true
end
