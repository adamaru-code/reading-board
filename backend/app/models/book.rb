class Book < ApplicationRecord
  # 所有者（単一ユーザー認証。1 対多）
  belongs_to :user

  # enum の validate: true … enum に無い値を代入しても例外にせず、検証エラー（422）として扱う（Rails 7.1+ の標準）

  # カンバンのカラムに対応する状態（読みたい / 読書中 / 読了）
  enum :status, { want_to_read: 0, reading: 1, read: 2 }, validate: true

  # 主ジャンル（単一）。詳細は docs/database-design.md §3。
  # 整数で保存するので、追加するときは既存の番号を変えずに末尾の番号を使う（it_tech は後から追加して 5）
  enum :genre, { classic_novel: 0, liberal_arts: 1, health_body: 2, practical: 3, other: 4, it_tech: 5 },
    default: :other, validate: true

  # 形態（書籍 / 雑誌）。値名 book が scope 名と紛らわしいため prefix を付ける
  enum :media_type, { book: 0, magazine: 1 }, default: :book, prefix: :media, validate: true

  # タグ（多対多）。API とは名称配列でやり取りする
  has_many :book_tags, dependent: :destroy
  has_many :tags, through: :book_tags

  # 状態に入った日の履歴（カラム移動のたびに 1 レコード）
  has_many :status_events, class_name: "BookStatusEvent", dependent: :destroy

  # 作成時と status 変更時に、その状態へ「入った日」を当日で記録する
  after_create :record_status_event
  after_update :record_status_event, if: :saved_change_to_status?

  validates :title, presence: true, length: { maximum: 255 }
  validates :rating, inclusion: { in: 0..5 }, allow_nil: true
  validate :isbn_must_be_valid
  validate :cover_url_must_be_google_image

  # tags: string[] を受け取り、書き方をそろえて（Tag.normalize_name）find_or_create で紐づける。
  # そろえたあとも DB が同じ名前とみなすもの（大文字・小文字、ひらがな・カタカナなど）は同じタグになるので、
  # タグで重複を除いて 1 回だけ付ける（2 回付けると book_tags の UNIQUE に当たって保存に失敗する）
  def tag_names=(names)
    cleaned = Array(names).map { |name| Tag.normalize_name(name) }.reject(&:blank?).uniq
    self.tags = cleaned.map { |name| Tag.find_or_create_by(name: name) }.uniq
  end

  def tag_names
    tags.map(&:name)
  end

  # 各状態に「最初に入った日」。読み込み済みの status_events から算出（N+1 回避）
  def registered_on = first_occurred_on("want_to_read")
  def started_on = first_occurred_on("reading")
  def finished_on = first_occurred_on("read")

  # 所要日数＝読了日−開始日（両方あるときのみ）
  def duration_days
    return nil unless started_on && finished_on

    (finished_on - started_on).to_i
  end

  # 空文字は「無し」として保存する
  def isbn=(value)
    super(value.present? ? OpenbdClient.normalize(value) : nil)
  end

  def cover_url=(value)
    super(value.presence)
  end

  private

  def isbn_must_be_valid
    errors.add(:isbn, :invalid) if isbn.present? && !OpenbdClient.valid?(isbn)
  end

  # 表紙は Google Books の画像（https）だけを許す（勝手な URL を保存・表示させない）
  def cover_url_must_be_google_image
    return if cover_url.blank?

    uri = URI.parse(cover_url)
    valid = uri.is_a?(URI::HTTPS) && GoogleBooksClient::COVER_HOSTS.include?(uri.host) && cover_url.length <= 500
    errors.add(:cover_url, :invalid) unless valid
  rescue URI::InvalidURIError
    errors.add(:cover_url, :invalid)
  end

  def first_occurred_on(status_name)
    status_events.select { |e| e.status == status_name }.map(&:occurred_on).min
  end

  def record_status_event
    status_events.find_or_create_by(status: status, occurred_on: Date.current)
  end
end
