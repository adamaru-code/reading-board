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

  test "genre は 5 種を扱え、デフォルトは other" do
    assert_equal %w[classic_novel liberal_arts health_body practical other], Book.genres.keys
    assert_equal "other", Book.new.genre
    assert Book.new(title: "x", genre: :liberal_arts).liberal_arts?
  end

  test "media_type は書籍/雑誌を扱え、デフォルトは book" do
    assert_equal %w[book magazine], Book.media_types.keys
    assert_equal "book", Book.new.media_type
    assert Book.new(title: "x", media_type: :magazine).media_magazine?
  end

  test "tag_names= は名称配列を正規化して紐づける（重複・空白除去）" do
    book = Book.create!(title: "x", tag_names: ["名著", " 名著 ", "", "入門"])
    assert_equal %w[名著 入門], book.reload.tags.map(&:name)
  end

  test "同名タグは既存を再利用する（find_or_create）" do
    Book.create!(title: "a", tag_names: ["再読"])
    assert_difference "Tag.count", 0 do
      Book.create!(title: "b", tag_names: ["再読"])
    end
  end

  test "tag_names= に空配列を渡すと全タグを外す" do
    book = Book.create!(title: "x", tag_names: ["名著"])
    book.update!(tag_names: [])
    assert_empty book.reload.tags
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
