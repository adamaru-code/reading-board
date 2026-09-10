// /api/books の CRUD クライアント。バックエンド Api::BooksController に対応する。
import { request } from './http'
import type {
  Book,
  BookCreateInput,
  BookUpdateInput,
  BookListParams,
} from '../types/book'

// GET /api/books （status・author で絞り込み可）
export function listBooks(params: BookListParams = {}): Promise<Book[]> {
  return request<Book[]>('/books', {
    query: { status: params.status, author: params.author },
  })
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
