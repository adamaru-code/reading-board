require "test_helper"

class BookTest < ActiveSupport::TestCase
  setup do
    @user = users(:owner)
  end

  test "有効な属性なら保存できる" do
    book = Book.new(title: "テスト駆動開発", status: :reading, user: @user)
    assert book.valid?
  end

  test "user が無いと無効" do
    assert_not Book.new(title: "x").valid?
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

  test "genre は 6 種を扱え、デフォルトは other" do
    assert_equal %w[classic_novel liberal_arts health_body practical other it_tech], Book.genres.keys
    assert_equal "other", Book.new.genre
    assert Book.new(title: "x", genre: :liberal_arts).liberal_arts?
  end

  test "media_type は書籍/雑誌を扱え、デフォルトは book" do
    assert_equal %w[book magazine], Book.media_types.keys
    assert_equal "book", Book.new.media_type
    assert Book.new(title: "x", media_type: :magazine).media_magazine?
  end

  test "tag_names= は名称配列を正規化して紐づける（重複・空白除去）" do
    book = @user.books.create!(title: "x", tag_names: [ "名著", " 名著 ", "", "入門" ])
    assert_equal %w[名著 入門], book.reload.tags.map(&:name)
  end

  test "同名タグは既存を再利用する（find_or_create）" do
    @user.books.create!(title: "a", tag_names: [ "再読" ])
    assert_difference "Tag.count", 0 do
      @user.books.create!(title: "b", tag_names: [ "再読" ])
    end
  end

  test "tag_names= に空配列を渡すと全タグを外す" do
    book = @user.books.create!(title: "x", tag_names: [ "名著" ])
    book.update!(tag_names: [])
    assert_empty book.reload.tags
  end

  test "作成時に初期 status のイベントを当日で記録する" do
    book = @user.books.create!(title: "x", status: :reading)
    assert_equal 1, book.status_events.size
    assert_equal "reading", book.status_events.first.status
    assert_equal Date.current, book.status_events.first.occurred_on
  end

  test "状態の日付は日本時間の今日（UTC では前の日の朝 5 時でも、日本時間の日付で記録する）" do
    travel_to Time.utc(2026, 6, 14, 20, 0) do # 日本時間 2026-06-15 05:00
      book = @user.books.create!(title: "x", status: :want_to_read)
      book.update!(status: :read)
      assert_equal Date.new(2026, 6, 15), book.registered_on
      assert_equal Date.new(2026, 6, 15), book.finished_on
    end
  end

  test "status 変更で新しいイベントを記録する" do
    book = @user.books.create!(title: "x", status: :want_to_read)
    book.update!(status: :reading)
    assert_equal %w[reading want_to_read], book.status_events.map(&:status).sort
  end

  test "status 以外の更新や同一状態ではイベントを増やさない" do
    book = @user.books.create!(title: "x", status: :reading)
    book.update!(rating: 3)
    book.update!(status: :reading)
    assert_equal 1, book.status_events.count
  end

  test "導出日付と所要日数を算出する" do
    book = @user.books.create!(title: "x", status: :want_to_read)
    book.status_events.create!(status: :reading, occurred_on: Date.new(2026, 1, 10))
    book.status_events.create!(status: :read, occurred_on: Date.new(2026, 1, 20))
    book.reload
    assert_equal Date.current, book.registered_on
    assert_equal Date.new(2026, 1, 10), book.started_on
    assert_equal Date.new(2026, 1, 20), book.finished_on
    assert_equal 10, book.duration_days
  end

  test "開始日が無ければ所要日数は nil" do
    book = @user.books.create!(title: "x", status: :want_to_read)
    assert_nil book.duration_days
  end

  test "ISBN はハイフンを除いて保存し、不正な形は無効。空は nil" do
    book = Book.new(title: "x", isbn: "978-4-87311-565-8")
    assert_equal "9784873115658", book.isbn
    assert_nil Book.new(title: "x", isbn: "").isbn
    invalid = Book.new(user: users(:owner), title: "x", isbn: "123")
    assert_not invalid.valid?
    assert_includes invalid.errors[:isbn], "は不正な値です"
  end

  test "表紙の URL は Google の画像（https）だけ有効。空は nil" do
    user = users(:owner)
    ok = %w[https://books.google.com/books/content?id=a https://books.googleusercontent.com/books/content?id=a]
    ok.each { |url| assert Book.new(user: user, title: "x", cover_url: url).valid?, url }
    ng = %w[http://books.google.com/books/content?id=a https://evil.example.com/a.jpg javascript:alert(1)]
    ng.each { |url| assert_not Book.new(user: user, title: "x", cover_url: url).valid?, url }
    assert_nil Book.new(title: "x", cover_url: "").cover_url
  end

  test "title が無いと無効" do
    book = Book.new(title: nil)
    assert_not book.valid?
    assert_includes book.errors[:title], "を入力してください"
  end

  test "rating が 0〜5 の範囲外だと無効" do
    assert_not Book.new(title: "x", rating: 6).valid?
    assert_not Book.new(title: "x", rating: -1).valid?
  end

  test "rating は未設定でも有効" do
    assert Book.new(title: "x", rating: nil, user: @user).valid?
  end
end
