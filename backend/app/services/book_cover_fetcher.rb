# ISBN があって表紙が無い自分の本に、Google Books の表紙をまとめて付ける（アカウント画面の「表紙」。POST /api/books/fetch_covers）。
# 1 回の呼び出しで最大 BATCH_SIZE 冊。画面は after_id を進めながら、残りが 0 か止まるまで繰り返す
# （1 回のリクエストを短くして、待ち時間の上限に当たらないようにするため）。
# - 見つからなかった本は数えて先へ進む。次に押したときはもう一度探す（列は増やさない）
# - Google の回数の上限・鍵なし・失敗のときは、残りも同じ理由で失敗するので、そこで止める（止めた本は数えない）
# - Google の 1 分の上限（Queries per minute per user＝100 回。2026-10-15 に管理画面で確認）を超えないよう、
#   問い合わせの間を INTERVAL 秒空ける（10 冊で約 6 秒。1 回のリクエストの待ち時間の上限より十分短い）
class BookCoverFetcher
  BATCH_SIZE = 10
  INTERVAL = 0.6

  # updated / not_found：付けた・見つからなかった冊数 / last_id：次に渡す after_id /
  # remaining：last_id より後の対象の冊数 / stopped：nil か "limited" / "rate_limited" / "no_key" / "error"
  Result = Struct.new(:updated, :not_found, :last_id, :remaining, :stopped, keyword_init: true)

  # interval：問い合わせの間の秒数（テストでは 0）
  def initialize(user, interval: INTERVAL)
    @user = user
    @interval = interval
  end

  # ISBN があって表紙が無い本（表紙が空文字のものも含める）
  def targets
    @user.books.where.not(isbn: [ nil, "" ]).where(cover_url: [ nil, "" ]).order(:id)
  end

  def call(after_id: 0)
    updated = 0
    not_found = 0
    last_id = after_id.to_i
    stopped = nil

    targets.where("books.id > ?", last_id).limit(BATCH_SIZE).each_with_index do |book, i|
      sleep(@interval) if i.positive? && @interval.positive?
      result = GoogleBooksClient.lookup(book.isbn)
      case result.status
      when :found
        book.update!(cover_url: result.url)
        updated += 1
      when :not_found
        not_found += 1
      else
        stopped = result.status.to_s
        break
      end
      last_id = book.id
    end

    Result.new(updated: updated, not_found: not_found, last_id: last_id,
               remaining: targets.where("books.id > ?", last_id).count, stopped: stopped)
  end
end
