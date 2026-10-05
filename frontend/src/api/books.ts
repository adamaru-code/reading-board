// /api/books の CRUD クライアント。バックエンド Api::BooksController に対応する。
import { request } from './http'
import type {
  Book,
  BookCreateInput,
  BookUpdateInput,
  BookListParams,
  BookListPaging,
  BookListResult,
  BookLookupResult,
  BookStats,
  BookImportPreview,
  BookImportResult,
} from '../types/book'

// GET /api/books （絞り込み＋並び替え＋ページング。1ページ分を返す）
export function listBooks(
  params: BookListParams = {},
  paging: BookListPaging = {},
): Promise<BookListResult> {
  const { page, offset, perPage = 100, sort, dir } = paging
  return request<BookListResult>('/books', {
    query: {
      status: params.status,
      genre: params.genre,
      q: params.q,
      author: params.author,
      tag: params.tag,
      rating: params.rating,
      page: page === undefined ? undefined : String(page),
      offset: offset === undefined ? undefined : String(offset),
      per_page: String(perPage),
      sort,
      dir,
    },
  })
}

// 全ページを集約して全件を返す（タグ選択肢の収集など、全件が要る場合）
export async function listAllBooks(params: BookListParams = {}): Promise<Book[]> {
  const perPage = 100
  const first = await listBooks(params, { page: 1, perPage })
  const items = [...first.items]
  for (let page = 2; page <= first.pagination.total_pages; page++) {
    const next = await listBooks(params, { page, perPage })
    items.push(...next.items)
  }
  return items
}

// GET /api/books/:id
export function getBook(id: number): Promise<Book> {
  return request<Book>(`/books/${id}`)
}

// POST /api/books
export function createBook(input: BookCreateInput): Promise<Book> {
  return request<Book>('/books', { method: 'POST', body: { book: input } })
}

// PATCH /api/books/:id
export function updateBook(id: number, input: BookUpdateInput): Promise<Book> {
  return request<Book>(`/books/${id}`, { method: 'PATCH', body: { book: input } })
}

// DELETE /api/books/:id
export function deleteBook(id: number): Promise<void> {
  return request<void>(`/books/${id}`, { method: 'DELETE' })
}

// GET /api/books/lookup?isbn= （openBD 照会）
export function lookupBook(isbn: string): Promise<BookLookupResult> {
  return request<BookLookupResult>('/books/lookup', { query: { isbn } })
}

// GET /api/books/stats?year= （読了冊数。year を省くと今年）
export function getBookStats(year?: number): Promise<BookStats> {
  return request<BookStats>('/books/stats', {
    query: { year: year === undefined ? undefined : String(year) },
  })
}

// POST /api/books/import （CSV の本をまとめて登録。dryRun は登録せず件数だけ。間違った行があれば ApiError 422）
export function importBooks(csv: string, dryRun: true): Promise<BookImportPreview>
export function importBooks(csv: string, dryRun: false): Promise<BookImportResult>
export function importBooks(
  csv: string,
  dryRun: boolean,
): Promise<BookImportPreview | BookImportResult> {
  return request('/books/import', { method: 'POST', body: { csv, dry_run: dryRun } })
}

// PATCH /api/books/reorder （渡した id 順に position を保存）
export function reorderBooks(ids: number[]): Promise<void> {
  return request<void>('/books/reorder', { method: 'PATCH', body: { ids } })
}
