require "test_helper"

class BookTest < ActiveSupport::TestCase
  test "有効な属性なら保存できる" do
    book = Book.new(title: "テスト駆動開発", status: :reading)
    assert book.valid?
  end

  test "status は 3 状態を扱える" do
    assert_equal 0, Book.statuses[:want_to_read]
    assert_equal 1, Book.statuses[:reading]
    assert_equal 2, Book.statuses[:read]

    book = Book.new(title: "サンプル", status: :read)
    assert book.read?
  end

  test "status のデフォルトは want_to_read" do
    assert_equal "want_to_read", Book.new.status
  end

  test "title が無いと無効" do
    book = Book.new(title: nil)
    assert_not book.valid?
    assert_includes book.errors[:title], "can't be blank"
  end

  test "rating が 0〜5 の範囲外だと無効" do
    assert_not Book.new(title: "x", rating: 6).valid?
    assert_not Book.new(title: "x", rating: -1).valid?
  end

  test "rating は未設定でも有効" do
    assert Book.new(title: "x", rating: nil).valid?
  end
end
