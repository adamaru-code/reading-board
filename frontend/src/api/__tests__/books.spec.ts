import { describe, it, expect, vi } from 'vitest'
import { listAllBooks } from '../books'
import type { Book } from '../../types/book'

const book = (id: number) => ({ id, title: `本${id}` }) as Book

describe('listAllBooks', () => {
  it('total_pages 分のページを順に取得して結合する', async () => {
    const pages: Record<string, Book[]> = { '1': [book(1), book(2)], '2': [book(3)] }
    const fetchMock = vi.fn(async (url: string) => {
      const page = new URL(url, 'http://localhost').searchParams.get('page') ?? '1'
      return new Response(
        JSON.stringify({
          items: pages[page],
          pagination: { page: Number(page), per_page: 100, total: 3, total_pages: 2 },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const books = await listAllBooks({ status: 'read' })

    expect(books.map((b) => b.id)).toEqual([1, 2, 3])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toContain('status=read')
  })
})
