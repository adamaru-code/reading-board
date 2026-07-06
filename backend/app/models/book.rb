class Book < ApplicationRecord
  # カンバンのカラムに対応する状態（読みたい / 読書中 / 読了）
  enum :status, { want_to_read: 0, reading: 1, read: 2 }

  validates :title, presence: true, length: { maximum: 255 }
  validates :rating, inclusion: { in: 0..5 }, allow_nil: true
end
