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

  # 表紙画像の URL（https）。鍵が無い・該当が無い・画像が無い・失敗したときは nil
  def self.cover_url(isbn, api_key: ENV["GOOGLE_BOOKS_API_KEY"])
    return nil if api_key.blank?

    uri = URI(ENDPOINT)
    uri.query = URI.encode_www_form(q: "isbn:#{isbn}", key: api_key)
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true,
                               open_timeout: OPEN_TIMEOUT, read_timeout: READ_TIMEOUT) do |http|
      http.get(uri.request_uri)
    end
    return nil unless response.is_a?(Net::HTTPSuccess)

    thumbnail = JSON.parse(response.body).dig("items", 0, "volumeInfo", "imageLinks", "thumbnail")
    to_https(thumbnail)
  rescue StandardError => e
    # 鍵が URL に入るので、ログには ISBN とエラーの種類だけを残す
    Rails.logger.warn("Google Books lookup failed for #{isbn}: #{e.class}")
    nil
  end

  # Google は http:// の URL を返すことがあるので https:// にそろえる（ページは https で開くため）
  def self.to_https(url)
    return nil if url.blank?

    url.sub(%r{\Ahttp://}, "https://")
  end
end
