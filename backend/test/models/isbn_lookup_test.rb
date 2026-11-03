require "test_helper"

class IsbnLookupTest < ActiveSupport::TestCase
  ISBN = "9784873115658".freeze
  COVER = "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1".freeze

  # OpenbdClient.lookup を差し替える（minitest 6 には stub が無いため）。問い合わせた回数を返す
  def with_openbd(status, info = nil)
    calls = 0
    original = OpenbdClient.method(:lookup)
    OpenbdClient.define_singleton_method(:lookup) do |*|
      calls += 1
      OpenbdClient::Result.new(status, info)
    end
    yield
    calls
  ensure
    OpenbdClient.define_singleton_method(:lookup, original)
  end

  def with_google(status, url = nil)
    calls = 0
    original = GoogleBooksClient.method(:lookup)
    GoogleBooksClient.define_singleton_method(:lookup) do |*, **|
      calls += 1
      GoogleBooksClient::Result.new(status, url)
    end
    yield
    calls
  ensure
    GoogleBooksClient.define_singleton_method(:lookup, original)
  end

  test "書誌：見つかった結果は 30 日のあいだ取っておき、過ぎたら問い合わせ直す" do
    info = { title: "リーダブルコード", author: "Dustin Boswell" }
    calls = with_openbd(:found, info) do
      assert_equal info, IsbnLookup.bibliography(ISBN)
      travel 29.days do
        assert_equal info, IsbnLookup.bibliography(ISBN)
      end
    end
    assert_equal 1, calls

    calls = with_openbd(:found, info) do
      travel(31.days) { IsbnLookup.bibliography(ISBN) }
    end
    assert_equal 1, calls
  end

  test "書誌：見つからなかった結果は 7 日のあいだ取っておく" do
    calls = with_openbd(:not_found) do
      assert_nil IsbnLookup.bibliography(ISBN)
      travel(6.days) { assert_nil IsbnLookup.bibliography(ISBN) }
    end
    assert_equal 1, calls
    assert_equal 1, with_openbd(:not_found) { travel(8.days) { IsbnLookup.bibliography(ISBN) } }
  end

  test "書誌：つながらなかった結果は取っておかず、次にまた問い合わせる" do
    calls = with_openbd(:error) { 2.times { assert_nil IsbnLookup.bibliography(ISBN) } }
    assert_equal 2, calls
    assert_not IsbnLookup.exists?(isbn: ISBN)
  end

  test "表紙：見つかった結果は取っておき、上限・鍵なし・失敗は取っておかない" do
    calls = with_google(:found, COVER) do
      2.times { assert_equal COVER, IsbnLookup.cover(ISBN).url }
    end
    assert_equal 1, calls

    other = "9784000000001"
    %i[limited rate_limited no_key error].each do |status|
      assert_equal 2, with_google(status) { 2.times { IsbnLookup.cover(other) } }, status
    end
    assert_nil IsbnLookup.cached_cover(other)
  end

  test "書誌と表紙は別々に取っておく（片方だけ調べても、もう片方は問い合わせる）" do
    with_openbd(:found, { title: "T", author: nil }) { IsbnLookup.bibliography(ISBN) }
    assert_nil IsbnLookup.cached_cover(ISBN)
    assert_equal 1, with_google(:not_found) { 2.times { IsbnLookup.cover(ISBN) } }
    assert_equal :not_found, IsbnLookup.cached_cover(ISBN).status
    assert_equal 1, IsbnLookup.where(isbn: ISBN).count
  end
end
