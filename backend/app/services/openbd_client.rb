require "net/http"
require "json"

# openBD（https://openbd.jp）から ISBN で書誌情報を取得するクライアント。
# ISBN の正規化・妥当性判定・形態判定などの純粋関数もここに集約する。
class OpenbdClient
  ENDPOINT = "https://api.openbd.jp/v1/get".freeze

  # ハイフン・空白などを除去し、数字（と ISBN-10 末尾の X）だけにする
  def self.normalize(raw)
    raw.to_s.gsub(/[^0-9Xx]/, "").upcase
  end

  # ISBN-13（13桁）または ISBN-10（9桁＋数字/X）
  def self.valid?(isbn)
    isbn.match?(/\A(\d{13}|\d{9}[0-9X])\z/)
  end

  # 491 始まり（定期刊行物）は雑誌、それ以外・ISBN-10 は書籍
  def self.media_type_for(isbn)
    isbn.start_with?("491") ? "magazine" : "book"
  end

  # 該当があれば { title:, author: } を返す。無ければ / 失敗すれば nil
  def self.fetch(isbn)
    uri = URI(ENDPOINT)
    uri.query = URI.encode_www_form(isbn: isbn)
    response = Net::HTTP.get_response(uri)
    return nil unless response.is_a?(Net::HTTPSuccess)

    record = JSON.parse(response.body)&.first
    summary = record && record["summary"]
    return nil if summary.blank? || summary["title"].blank?

    { title: summary["title"], author: summary["author"].presence }
  rescue StandardError => e
    Rails.logger.warn("openBD lookup failed for #{isbn}: #{e.message}")
    nil
  end
end
