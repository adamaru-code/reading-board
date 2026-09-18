// 書籍の型定義。バックエンド Api::BooksController の JSON 契約に一致させる。

// カンバンのカラムに対応する状態（Rails 側 enum のキー文字列）
export type BookStatus = 'want_to_read' | 'reading' | 'read'

// status の全キー（セレクトの選択肢や絞り込みで使い回す）
export const BOOK_STATUSES: readonly BookStatus[] = ['want_to_read', 'reading', 'read']

// 主ジャンル（単一）。Rails 側 enum のキー文字列（docs/database-design.md §3）
export type BookGenre = 'classic_novel' | 'liberal_arts' | 'health_body' | 'practical' | 'other'
export const BOOK_GENRES: readonly BookGenre[] = [
  'classic_novel',
  'liberal_arts',
  'health_body',
  'practical',
  'other',
]
export const GENRE_LABELS: Record<BookGenre, string> = {
  classic_novel: '古典・名作小説',
  liberal_arts: '教養・人文・思想',
  health_body: '健康・身体',
  practical: '実用・暮らし',
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
  tags: string[]
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
  tags?: string[]
}

// 更新時の入力（全項目任意）
export type BookUpdateInput = Partial<BookCreateInput>

// 一覧の絞り込み条件（status・author の部分一致。互いに AND）
export interface BookListParams {
  status?: BookStatus
  author?: string
}
