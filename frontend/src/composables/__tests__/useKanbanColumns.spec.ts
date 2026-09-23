import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useKanbanColumns, COLUMN_PAGE_SIZE } from '../useKanbanColumns'
import * as booksApi from '../../api/books'
import type { Book, BookStatus, BookListParams, BookListPaging } from '../../types/book'

const book = (id: number, status: BookStatus) => ({ id, status, position: null }) as Book

// status ごとの「サーバー上の並び」を用意し、offset / perPage で切り出して返すフェイク
let server: Record<BookStatus, Book[]>
function fakeListBooks() {
  return vi
    .spyOn(booksApi, 'listBooks')
    .mockImplementation(async (params: BookListParams = {}, paging: BookListPaging = {}) => {
      const all = server[params.status!]
      const offset = paging.offset ?? 0
      const perPage = paging.perPage ?? 100
      return {
        items: all.slice(offset, offset + perPage).map((b) => ({ ...b })),
        pagination: { page: 1, per_page: perPage, total: all.length, total_pages: 1 },
      }
    })
}

const range = (from: number, count: number, status: BookStatus) =>
  Array.from({ length: count }, (_, i) => book(from + i, status))

beforeEach(() => {
  server = { want_to_read: range(1, 25, 'want_to_read'), reading: range(101, 3, 'reading'), read: [] }
})

describe('useKanbanColumns', () => {
  it('各カラムを先頭 1 ページずつ取得し、total と残りの有無を持つ', async () => {
    const spy = fakeListBooks()
    const { columns, reloadAll, hasMore } = useKanbanColumns(() => ({ genre: 'other' }))

    await reloadAll()

    expect(columns.want_to_read.items).toHaveLength(COLUMN_PAGE_SIZE)
    expect(columns.want_to_read.total).toBe(25)
    expect(hasMore('want_to_read')).toBe(true)
    expect(hasMore('reading')).toBe(false)
    expect(spy).toHaveBeenCalledWith(
      { genre: 'other', status: 'want_to_read' },
      { offset: 0, perPage: COLUMN_PAGE_SIZE },
    )
  })

  it('カラムごとの並び指定を渡す', async () => {
    const spy = fakeListBooks()
    const { reloadColumn } = useKanbanColumns(
      () => ({}),
      (status) => (status === 'read' ? { sort: 'rating', dir: 'desc' } : {}),
    )

    await reloadColumn('read')

    expect(spy).toHaveBeenCalledWith(
      { status: 'read' },
      { offset: 0, perPage: COLUMN_PAGE_SIZE, sort: 'rating', dir: 'desc' },
    )
  })

  it('もっと見るで続きを追加する', async () => {
    fakeListBooks()
    const { columns, reloadAll, loadMore, hasMore } = useKanbanColumns(() => ({}))
    await reloadAll()

    await loadMore('want_to_read')

    expect(columns.want_to_read.items.map((b) => b.id)).toEqual(range(1, 25, 'want_to_read').map((b) => b.id))
    expect(hasMore('want_to_read')).toBe(false)
  })

  it('カードを他カラムへ移した後のもっと見るで取りこぼさない', async () => {
    fakeListBooks()
    const { columns, reloadAll, loadMore, findBook, moveBook } = useKanbanColumns(() => ({}))
    await reloadAll()

    // 1 番を「読書中」の先頭へ移動（サーバー側も同様に更新される）
    const targetIds = moveBook(findBook(1)!, 'reading', 0)
    server.want_to_read = server.want_to_read.filter((b) => b.id !== 1)
    server.reading = [book(1, 'reading'), ...server.reading]

    expect(targetIds).toEqual([1, 101, 102, 103])
    expect(columns.want_to_read.total).toBe(24)
    expect(columns.reading.total).toBe(4)

    await loadMore('want_to_read')

    // 2..25 が欠けも重複もなく揃う（page 番号方式だと 21 番を取りこぼす）
    expect(columns.want_to_read.items.map((b) => b.id)).toEqual(range(2, 24, 'want_to_read').map((b) => b.id))
  })

  it('同じカラム内の移動は件数を変えず、position を振り直す', async () => {
    fakeListBooks()
    const { columns, reloadAll, findBook, moveBook } = useKanbanColumns(() => ({}))
    await reloadAll()

    const ids = moveBook(findBook(103)!, 'reading', 0)

    expect(ids).toEqual([103, 101, 102])
    expect(columns.reading.total).toBe(3)
    expect(columns.reading.items.map((b) => b.position)).toEqual([0, 1, 2])
  })

  it('keepLoaded の再取得は読み込み済み件数を保つ', async () => {
    const spy = fakeListBooks()
    const { columns, reloadAll, loadMore } = useKanbanColumns(() => ({}))
    await reloadAll()
    await loadMore('want_to_read')
    spy.mockClear()

    await reloadAll(true)

    expect(columns.want_to_read.items).toHaveLength(25)
    expect(spy).toHaveBeenCalledWith({ status: 'want_to_read' }, { offset: 0, perPage: 25 })
  })
})
