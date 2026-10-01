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

// 読了冊数（GET /api/books/stats）。今「読了」の本のうち、読了日が今年・今月のもの。絞り込みには連動しない
export interface BookStats {
  finished_this_year: number
  finished_this_month: number
}

// 一覧の絞り込み条件（互いに AND。q はタイトルまたは著者の部分一致、author は著者の部分一致、genre/tag は完全一致）
export interface BookListParams {
  status?: BookStatus
  genre?: BookGenre
  q?: string
  author?: string
  tag?: string
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
