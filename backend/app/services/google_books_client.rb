require "net/http"
require "json"

# Google Books（Books API）から ISBN で表紙画像の URL を取得するクライアント。
# 書誌（タイトル・著者）は今までどおり openBD（OpenbdClient）から取り、ここでは表紙だけを扱う
# （openBD は表紙を持たない本が多く、国立国会図書館の書影 API は 2026-03-31 に終了したため）。
# API キーは環境変数 GOOGLE_BOOKS_API_KEY（開発は backend/mise.local.toml、本番は SSM）。無ければ表紙なし
class GoogleBooksClient
  ENDPOINT = "https://www.googleapis.com/books/v1/volumes".freeze
  # 保存してよい表紙画像のホスト（Book の検証でも使う）
  COVER_HOSTS = %w[books.google.com books.googleusercontent.com].freeze
  OPEN_TIMEOUT = 3
  READ_TIMEOUT = 5
  # 回数の上限に当たったことを表す理由（それ以外の 403 は鍵の間違いなど）。
  # 1 日の上限（Queries per day）と 1 分の上限（Queries per minute per user）は、どちらも 429 や
  # rateLimitExceeded で返ることがあるので、本文の「per day」で 1 日の上限かどうかを見分ける
  LIMIT_REASONS = %w[dailyLimitExceeded rateLimitExceeded userRateLimitExceeded quotaExceeded].freeze

  # status：:found（url あり）/ :not_found（該当なし・画像なし）/ :limited（1 日の回数の上限）/
  #         :rate_limited（1 分の回数の上限。少し待てば続けられる）/
  #         :no_key（鍵が無い）/ :error（鍵の間違い・タイムアウトなど、ほかの失敗）
  Result = Struct.new(:status, :url)

  # 表紙画像の URL（https）。鍵が無い・該当が無い・画像が無い・失敗したときは nil
  def self.cover_url(isbn, api_key: ENV["GOOGLE_BOOKS_API_KEY"])
    lookup(isbn, api_key: api_key).url
  end

  # 表紙を探した結果を、見つからなかった理由と一緒に返す（まとめて取得で、上限に当たったら止めるため）
  def self.lookup(isbn, api_key: ENV["GOOGLE_BOOKS_API_KEY"])
    return Result.new(:no_key, nil) if api_key.blank?

    uri = URI(ENDPOINT)
    uri.query = URI.encode_www_form(q: "isbn:#{isbn}", key: api_key)
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true,
                               open_timeout: OPEN_TIMEOUT, read_timeout: READ_TIMEOUT) do |http|
      http.get(uri.request_uri)
    end
    return Result.new(failure_status(response), nil) unless response.is_a?(Net::HTTPSuccess)

    thumbnail = JSON.parse(response.body).dig("items", 0, "volumeInfo", "imageLinks", "thumbnail")
    url = to_https(thumbnail)
    Result.new(url ? :found : :not_found, url)
  rescue StandardError => e
    # 鍵が URL に入るので、ログには ISBN とエラーの種類だけを残す
    Rails.logger.warn("Google Books lookup failed for #{isbn}: #{e.class}")
    Result.new(:error, nil)
  end

  # 回数の上限なら :limited（1 日）か :rate_limited（1 分）。ほかは :error
  def self.failure_status(response)
    too_many = response.is_a?(Net::HTTPTooManyRequests)
    return :error unless too_many || response.is_a?(Net::HTTPForbidden)

    error = parse_error(response.body)
    reasons = Array(error["errors"]).map { |e| e["reason"] }
    return :error unless too_many || (reasons & LIMIT_REASONS).any?

    daily = reasons.include?("dailyLimitExceeded") || error["message"].to_s.match?(/per day/i)
    daily ? :limited : :rate_limited
  end

  # エラー応答の本文の error（{ "message" => ..., "errors" => [{ "reason" => ... }] }）。読めなければ空
  def self.parse_error(body)
    JSON.parse(body.to_s)["error"] || {}
  rescue JSON::ParserError
    {}
  end

  # Google は http:// の URL を返すことがあるので https:// にそろえる（ページは https で開くため）
  def self.to_https(url)
    return nil if url.blank?

    url.sub(%r{\Ahttp://}, "https://")
  end
end
