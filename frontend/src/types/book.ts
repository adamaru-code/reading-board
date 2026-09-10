// 書籍の型定義。バックエンド Api::BooksController の JSON 契約に一致させる。

// カンバンのカラムに対応する状態（Rails 側 enum のキー文字列）
export type BookStatus = 'want_to_read' | 'reading' | 'read'

// status の全キー（セレクトの選択肢や絞り込みで使い回す）
export const BOOK_STATUSES: readonly BookStatus[] = ['want_to_read', 'reading', 'read']

// API が返す書籍 1 件
export interface Book {
  id: number
  title: string
  author: string | null
  status: BookStatus
  rating: number | null
  memo: string | null
  position: number | null
  created_at: string
  updated_at: string
}

// 作成時の入力（title 必須、それ以外は任意）
export interface BookCreateInput {
  title: string
  author?: string | null
  status?: BookStatus
  rating?: number | null
  memo?: string | null
  position?: number | null
}

// 更新時の入力（全項目任意）
export type BookUpdateInput = Partial<BookCreateInput>

// 一覧の絞り込み条件（status・author の部分一致。互いに AND）
export interface BookListParams {
  status?: BookStatus
  author?: string
}
