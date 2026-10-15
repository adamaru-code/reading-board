require "test_helper"

class BookCoverFetcherTest < ActiveSupport::TestCase
  COVER = "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1".freeze

  setup do
    @user = users(:other) # fixture の本が無いユーザー（owner には fixture の本がある）
  end

  # GoogleBooksClient.lookup を差し替える（minitest 6 には stub が無いため）。
  # statuses：ISBN → :found / :not_found / :limited など。問い合わせた ISBN を順に返す
  def with_lookup(statuses)
    asked = []
    original = GoogleBooksClient.method(:lookup)
    GoogleBooksClient.define_singleton_method(:lookup) do |isbn, **|
      asked << isbn
      status = statuses.fetch(isbn)
      GoogleBooksClient::Result.new(status, status == :found ? COVER : nil)
    end
    yield
    asked
  ensure
    GoogleBooksClient.define_singleton_method(:lookup, original)
  end

  def isbn(n) = format("97840000000%02d", n)

  test "ISBN があって表紙が無い本に表紙を付け、見つからない本は数える" do
    hit = @user.books.create!(title: "見つかる", isbn: isbn(1))
    miss = @user.books.create!(title: "見つからない", isbn: isbn(2))
    result = nil
    with_lookup(isbn(1) => :found, isbn(2) => :not_found) do
      result = BookCoverFetcher.new(@user, interval: 0).call
    end
    assert_equal 1, result.updated
    assert_equal 1, result.not_found
    assert_equal 0, result.remaining
    assert_nil result.stopped
    assert_equal COVER, hit.reload.cover_url
    assert_nil miss.reload.cover_url
  end

  test "他人の本・表紙がある本・ISBN が無い本は対象にしない" do
    target = @user.books.create!(title: "対象", isbn: isbn(1))
    @user.books.create!(title: "表紙あり", isbn: isbn(2), cover_url: COVER)
    @user.books.create!(title: "ISBN なし")
    users(:owner).books.create!(title: "他人の本", isbn: isbn(3))

    fetcher = BookCoverFetcher.new(@user, interval: 0)
    assert_equal [ target.id ], fetcher.targets.pluck(:id)
    asked = with_lookup(isbn(1) => :found) { fetcher.call }
    assert_equal [ isbn(1) ], asked
  end

  test "上限に当たったらそこで止め、止めた本は数えずに残りを返す" do
    first = @user.books.create!(title: "1", isbn: isbn(1))
    @user.books.create!(title: "2", isbn: isbn(2))
    @user.books.create!(title: "3", isbn: isbn(3))
    result = nil
    asked = with_lookup(isbn(1) => :found, isbn(2) => :limited, isbn(3) => :found) do
      result = BookCoverFetcher.new(@user, interval: 0).call
    end
    assert_equal [ isbn(1), isbn(2) ], asked # 3 冊目は問い合わせない
    assert_equal "limited", result.stopped
    assert_equal 1, result.updated
    assert_equal first.id, result.last_id
    assert_equal 2, result.remaining # 止めた本も残りに数える
  end

  test "問い合わせの間を interval 秒空ける（1 冊目の前は空けない）" do
    3.times { |i| @user.books.create!(title: "本#{i}", isbn: isbn(i)) }
    fetcher = BookCoverFetcher.new(@user, interval: 0.6)
    slept = []
    fetcher.define_singleton_method(:sleep) { |seconds| slept << seconds }
    with_lookup(isbn(0) => :not_found, isbn(1) => :not_found, isbn(2) => :not_found) { fetcher.call }
    assert_equal [ 0.6, 0.6 ], slept
  end

  test "1 分の上限でも止めて rate_limited を返す" do
    @user.books.create!(title: "1", isbn: isbn(1))
    result = nil
    with_lookup(isbn(1) => :rate_limited) { result = BookCoverFetcher.new(@user, interval: 0).call }
    assert_equal "rate_limited", result.stopped
    assert_equal 1, result.remaining
  end

  test "1 回は BATCH_SIZE 冊まで。after_id から続けられる" do
    books = Array.new(BookCoverFetcher::BATCH_SIZE + 2) { |i| @user.books.create!(title: "本#{i}", isbn: isbn(i)) }
    statuses = books.to_h { |b| [ b.isbn, :not_found ] }
    first = nil
    second = nil
    with_lookup(statuses) do
      first = BookCoverFetcher.new(@user, interval: 0).call
      second = BookCoverFetcher.new(@user, interval: 0).call(after_id: first.last_id)
    end
    assert_equal BookCoverFetcher::BATCH_SIZE, first.not_found
    assert_equal books[BookCoverFetcher::BATCH_SIZE - 1].id, first.last_id
    assert_equal 2, first.remaining
    assert_equal 2, second.not_found
    assert_equal 0, second.remaining
  end

  test "題名と著者も渡す（isbn: で見つからないときの予備の探し方に使う）" do
    @user.books.create!(title: "リーダブルコード", author: "Dustin Boswell", isbn: isbn(1))
    received = nil
    original = GoogleBooksClient.method(:lookup)
    GoogleBooksClient.define_singleton_method(:lookup) do |isbn, **options|
      received = options.merge(isbn: isbn)
      GoogleBooksClient::Result.new(:not_found, nil)
    end
    BookCoverFetcher.new(@user, interval: 0).call
    assert_equal({ isbn: isbn(1), title: "リーダブルコード", author: "Dustin Boswell" }, received)
  ensure
    GoogleBooksClient.define_singleton_method(:lookup, original)
  end
end
