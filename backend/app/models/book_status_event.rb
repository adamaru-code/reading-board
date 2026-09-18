class BookStatusEvent < ApplicationRecord
  belongs_to :book

  # Book と同じ状態 enum（その状態に入った履歴）
  enum :status, { want_to_read: 0, reading: 1, read: 2 }

  validates :occurred_on, presence: true
end
