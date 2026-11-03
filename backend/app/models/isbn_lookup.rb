# ISBN で調べた結果（openBD の書誌・Google Books の表紙）を取っておき、同じ ISBN では外部に問い合わせない（#374）。
# - 見つかった結果は FOUND_TTL、見つからなかった結果は NOT_FOUND_TTL のあいだ使う（相手側にあとで登録されることがあるので短め）
# - 上限に当たった・つながらなかった・鍵が無い、は取っておかない（次にまた問い合わせる）
# - ISBN ごとに 1 行。期間を過ぎたら、次に調べたときに上書きする
class IsbnLookup < ApplicationRecord
  FOUND_TTL = 30.days
  NOT_FOUND_TTL = 7.days
  STATUSES = %w[found not_found].freeze

  validates :isbn, presence: true, length: { maximum: 13 }, uniqueness: true
  validates :biblio_status, inclusion: { in: STATUSES }, allow_nil: true
  validates :cover_status, inclusion: { in: STATUSES }, allow_nil: true

  # 書誌。見つかれば { title:, author: }、無い・失敗なら nil（OpenbdClient.fetch と同じ形）
  def self.bibliography(isbn)
    row = find_by(isbn: isbn)
    return row.biblio_info if row&.fresh?(row.biblio_status, row.biblio_checked_at)

    result = OpenbdClient.lookup(isbn)
    if STATUSES.include?(result.status.to_s)
      remember(isbn, biblio_status: result.status.to_s, title: result.info&.dig(:title),
                     author: result.info&.dig(:author), biblio_checked_at: Time.current)
    end
    result.info
  end

  # 取っておいた表紙の結果（GoogleBooksClient::Result）。無い・期間を過ぎていれば nil
  def self.cached_cover(isbn)
    row = find_by(isbn: isbn)
    return unless row&.fresh?(row.cover_status, row.cover_checked_at)

    GoogleBooksClient::Result.new(row.cover_status.to_sym, row.cover_url)
  end

  # 表紙（GoogleBooksClient::Result）。取っておいた結果があれば使い、無ければ Google に問い合わせる
  def self.cover(isbn, title: nil, author: nil)
    cached_cover(isbn) || fetch_cover(isbn, title: title, author: author)
  end

  def self.fetch_cover(isbn, title: nil, author: nil)
    result = GoogleBooksClient.lookup(isbn, title: title, author: author)
    if STATUSES.include?(result.status.to_s)
      remember(isbn, cover_status: result.status.to_s, cover_url: result.url, cover_checked_at: Time.current)
    end
    result
  end

  # ISBN の行に書き足す（無ければ作る）。同時に作られて重なったら、もう一度読み直して書き足す
  def self.remember(isbn, attributes)
    find_or_initialize_by(isbn: isbn).update!(attributes)
  rescue ActiveRecord::RecordNotUnique
    find_by!(isbn: isbn).update!(attributes)
  end
  private_class_method :remember

  def fresh?(status, checked_at)
    return false if status.nil? || checked_at.nil?

    checked_at > (status == "found" ? FOUND_TTL : NOT_FOUND_TTL).ago
  end

  def biblio_info
    biblio_status == "found" ? { title: title, author: author } : nil
  end
end
