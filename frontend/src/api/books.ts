// /api/books の CRUD クライアント。バックエンド Api::BooksController に対応する。
import { request } from './http'
import type {
  Book,
  BookCreateInput,
  BookUpdateInput,
  BookListParams,
  BookListResult,
  BookLookupResult,
} from '../types/book'

// GET /api/books （絞り込み＋ページング。1ページ分を返す）
export function listBooks(
  params: BookListParams = {},
  page = 1,
  perPage = 100,
): Promise<BookListResult> {
  return request<BookListResult>('/books', {
    query: {
      status: params.status,
      genre: params.genre,
      author: params.author,
      tag: params.tag,
      page: String(page),
      per_page: String(perPage),
    },
  })
}

// 全ページを集約して全件を返す（カンバンは全件をカラムに振り分けるため）
export async function listAllBooks(params: BookListParams = {}): Promise<Book[]> {
  const perPage = 100
  const first = await listBooks(params, 1, perPage)
  const items = [...first.items]
  for (let page = 2; page <= first.pagination.total_pages; page++) {
    const next = await listBooks(params, page, perPage)
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

// PATCH /api/books/reorder （渡した id 順に position を保存）
export function reorderBooks(ids: number[]): Promise<void> {
  return request<void>('/books/reorder', { method: 'PATCH', body: { ids } })
}
