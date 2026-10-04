require "test_helper"

class BookCsvExporterTest < ActiveSupport::TestCase
  setup do
    @user = users(:owner)
  end

  def parse(csv_text)
    CSV.parse(csv_text.delete_prefix(BookCsvExporter::BOM))
  end

  test "先頭に BOM を付け、1 行目は見出し" do
    text = BookCsvExporter.call([])
    assert text.start_with?("﻿")
    assert_equal [ BookCsvExporter::HEADERS ], parse(text)
  end

  test "状態・ジャンル・形態は画面と同じ日本語、タグは「、」区切り、日付は YYYY-MM-DD、所要日数は数字" do
    book = travel_to(Date.new(2026, 9, 1)) { @user.books.create!(title: "こころ", author: "夏目漱石", status: :reading, genre: :classic_novel, media_type: :book, rating: 4, isbn: "9784101010137", tag_names: %w[名著 再読したい]) }
    travel_to(Date.new(2026, 9, 11)) { book.update!(status: :read) }

    row = parse(BookCsvExporter.call([ book.reload ]))[1]
    assert_equal [ "こころ", "夏目漱石", "読了", "古典・名作小説", "書籍", "4", "名著、再読したい", nil, "9784101010137",
                   nil, "2026-09-01", "2026-09-11", "10" ], row
  end

  test "タグ・著者・メモが空の本は、その欄に何も書かない（\"\" にしない）" do
    book = @user.books.create!(title: "空の本", author: "", memo: "", status: :want_to_read)
    line = BookCsvExporter.call([ book ]).lines.last
    assert_not_includes line, '""'
    assert line.start_with?("空の本,,読みたい,その他・未分類,書籍,,,,,")
  end

  test "空の値は空欄、メモのカンマ・改行・引用符は崩れずに 1 つの欄に入る" do
    book = @user.books.create!(title: "雑誌", status: :want_to_read, media_type: :magazine, memo: "1行目, カンマ\n2行目 \"引用\"")
    row = parse(BookCsvExporter.call([ book ]))[1]
    assert_equal "雑誌", row[4]
    assert_nil row[1] # 著者なし
    assert_nil row[5] # 評価なし
    assert_equal "1行目, カンマ\n2行目 \"引用\"", row[7]
    assert_equal "その他・未分類", row[3]
  end
end
