require "csv"

# 本の一覧を CSV の文字列にする（アカウント画面の「書き出し」。GET /api/books/export）。
# Excel で日本語が文字化けしないよう先頭に BOM を付ける。状態・ジャンル・形態は画面と同じ日本語
# （frontend/src/types/book.ts などの表示名と同じ文字）。あとで作る読み込みでも同じ列の形を使う前提
class BookCsvExporter
  BOM = "﻿".freeze
  HEADERS = %w[タイトル 著者 状態 ジャンル 形態 評価 タグ メモ ISBN 登録日 開始日 読了日 所要日数].freeze
  STATUS_LABELS = { "want_to_read" => "読みたい", "reading" => "読書中", "read" => "読了" }.freeze
  GENRE_LABELS = {
    "classic_novel" => "古典・名作小説",
    "liberal_arts" => "教養・人文・思想",
    "health_body" => "健康・身体",
    "practical" => "実用・暮らし",
    "it_tech" => "IT・技術",
    "other" => "その他・未分類"
  }.freeze
  MEDIA_TYPE_LABELS = { "book" => "書籍", "magazine" => "雑誌" }.freeze
  TAG_SEPARATOR = "、".freeze

  # books：tags と status_events を読み込み済みの Book の一覧
  def self.call(books)
    BOM + CSV.generate do |csv|
      csv << HEADERS
      books.each { |book| csv << row(book) }
    end
  end

  def self.row(book)
    [
      book.title,
      book.author,
      STATUS_LABELS.fetch(book.status),
      GENRE_LABELS.fetch(book.genre),
      MEDIA_TYPE_LABELS.fetch(book.media_type),
      book.rating,
      book.tags.map(&:name).join(TAG_SEPARATOR),
      book.memo,
      book.isbn,
      book.registered_on&.iso8601,
      book.started_on&.iso8601,
      book.finished_on&.iso8601,
      book.duration_days
    ]
  end
end
