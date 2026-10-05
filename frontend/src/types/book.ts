// 書籍の型定義。バックエンド Api::BooksController の JSON 契約に一致させる。

// カンバンのカラムに対応する状態（Rails 側 enum のキー文字列）
export type BookStatus = 'want_to_read' | 'reading' | 'read'

// status の全キー（セレクトの選択肢や絞り込みで使い回す）
export const BOOK_STATUSES: readonly BookStatus[] = ['want_to_read', 'reading', 'read']

// 主ジャンル（単一）。Rails 側 enum のキー文字列（docs/database-design.md §3）
export type BookGenre =
  'classic_novel' | 'liberal_arts' | 'health_body' | 'practical' | 'it_tech' | 'other'
export const BOOK_GENRES: readonly BookGenre[] = [
  'classic_novel',
  'liberal_arts',
  'health_body',
  'practical',
  'it_tech',
  'other',
]
export const GENRE_LABELS: Record<BookGenre, string> = {
  classic_novel: '古典・名作小説',
  liberal_arts: '教養・人文・思想',
  health_body: '健康・身体',
  practical: '実用・暮らし',
  it_tech: 'IT・技術',
  other: 'その他・未分類',
}

// 形態（書籍 / 雑誌）
export type BookMediaType = 'book' | 'magazine'
export const BOOK_MEDIA_TYPES: readonly BookMediaType[] = ['book', 'magazine']
export const MEDIA_TYPE_LABELS: Record<BookMediaType, string> = {
  book: '書籍',
  magazine: '雑誌',
}

// API が返す書籍 1 件
export interface Book {
  id: number
  title: string
  author: string | null
  status: BookStatus
  genre: BookGenre
  media_type: BookMediaType
  rating: number | null
  memo: string | null
  position: number | null
  // 書影：ISBN（ハイフンなし）と、Google Books の表紙画像の URL。無ければ null
  isbn: string | null
  cover_url: string | null
  tags: string[]
  // 各状態に最初に入った日（YYYY-MM-DD）。未到達は null
  registered_on: string | null
  started_on: string | null
  finished_on: string | null
  duration_days: number | null
  created_at: string
  updated_at: string
}

// 作成時の入力（title 必須、それ以外は任意）
export interface BookCreateInput {
  title: string
  author?: string | null
  status?: BookStatus
  genre?: BookGenre
  media_type?: BookMediaType
  rating?: number | null
  memo?: string | null
  position?: number | null
  isbn?: string | null
  cover_url?: string | null
  tags?: string[]
}

// 更新時の入力（全項目任意）
export type BookUpdateInput = Partial<BookCreateInput>

// ISBN 照会（openBD）の結果。found=false は該当なし（手入力フォールバック）
export interface BookLookupResult {
  isbn: string
  found: boolean
  title: string | null
  author: string | null
  media_type: BookMediaType
  // 表紙画像の URL（Google Books）。鍵が無い・画像が無いときは null
  cover_url: string | null
}

// 読了冊数（GET /api/books/stats?year=）。今「読了」の自分の本を数える。日付は読了日（最初に読了になった日）。
// 絞り込みには連動しない。今年・今月・これまでは year に関係なくいつも同じ
export interface BookStats {
  finished_total: number // これまで（読了の本すべて）
  finished_this_year: number
  finished_this_month: number
  years: number[] // 選べる年（読了した本がある年＋今年、新しい順）
  year: number // 選んだ年（指定が無い・不正なら今年）
  finished_in_year: number // 選んだ年の冊数
  finished_by_month: number[] // 選んだ年の 1〜12 月（12 個）
  finished_by_genre: Record<BookGenre, number> // 選んだ年のジャンル別（6 ジャンルすべて）
}

// CSV 読み込み（POST /api/books/import）。skipped は自分の本と重なって飛ばす行（CSV の行番号とタイトル）
export interface BookImportSkipped {
  line: number
  title: string
}
// dry_run（取り込む前の確認）の結果
export interface BookImportPreview {
  to_create: number
  skipped: BookImportSkipped[]
}
// 取り込んだ結果
export interface BookImportResult {
  created: number
  skipped: BookImportSkipped[]
}

// 評価の絞り込み：'1'〜'5' はその★以上、'unrated' は未評価
export type RatingFilter = '1' | '2' | '3' | '4' | '5' | 'unrated'
// 絞り込みの選択肢（上から順に表示）
export const RATING_FILTER_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: '5', label: '★★★★★' },
  { value: '4', label: '★★★★ 以上' },
  { value: '3', label: '★★★ 以上' },
  { value: '2', label: '★★ 以上' },
  { value: '1', label: '★ 以上' },
  { value: 'unrated', label: '未評価' },
]

// 一覧の絞り込み条件（互いに AND。q はタイトルまたは著者の部分一致、author は著者の部分一致、genre/tag は完全一致）
export interface BookListParams {
  status?: BookStatus
  genre?: BookGenre
  q?: string
  author?: string
  tag?: string
  rating?: RatingFilter
}

// 並び替えキー（読了カラムで使用。値が無い本は常に末尾）
export type BookSortKey = 'finished_on' | 'rating' | 'registered_on' | 'duration_days'
export type SortDir = 'asc' | 'desc'

// 一覧の取得範囲と並び。offset を指定すると page より優先（API 側も同じ）
export interface BookListPaging {
  page?: number
  offset?: number
  perPage?: number
  sort?: BookSortKey
  dir?: SortDir
}

// ページ情報
export interface Pagination {
  page: number
  per_page: number
  total: number
  total_pages: number
}

// 一覧 API のレスポンス（items ＋ ページ情報）
export interface BookListResult {
  items: Book[]
  pagination: Pagination
}

// タグ候補から隠したタグ（Api::HiddenTagsController の JSON 契約に一致）
export interface HiddenTag {
  id: number
  name: string
}
