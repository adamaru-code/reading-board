// カンバンの各カラム（status）を個別にページ取得して保持する。
// 初期は COLUMN_PAGE_SIZE 件、「もっと見る」で offset 指定の追加読込。
import { reactive } from 'vue'
import { listBooks } from '../api/books'
import { BOOK_STATUSES } from '../types/book'
import type { Book, BookStatus, BookListParams, BookListPaging } from '../types/book'

export const COLUMN_PAGE_SIZE = 20
// API の per_page 上限（Api::BooksController#pagination_per_page）
const MAX_PER_PAGE = 200

export interface ColumnState {
  items: Book[]
  total: number
  loadingMore: boolean
}

export function useKanbanColumns(
  // 現在の絞り込み条件
  getParams: () => BookListParams,
  // カラムごとの並び（読了カラムの並び替えなど。無指定は position 順）
  getSort: (status: BookStatus) => Pick<BookListPaging, 'sort' | 'dir'> = () => ({}),
) {
  const emptyColumn = (): ColumnState => ({ items: [], total: 0, loadingMore: false })
  const columns = reactive<Record<BookStatus, ColumnState>>({
    want_to_read: emptyColumn(),
    reading: emptyColumn(),
    read: emptyColumn(),
  })

  function fetchColumn(status: BookStatus, offset: number, perPage: number) {
    return listBooks({ ...getParams(), status }, { offset, perPage, ...getSort(status) })
  }

  // keepLoaded: 読み込み済み件数を保って取り直す（編集後など）。false なら先頭 1 ページに戻す
  async function reloadColumn(status: BookStatus, keepLoaded = false) {
    const loaded = columns[status].items.length
    const perPage = keepLoaded
      ? Math.min(Math.max(COLUMN_PAGE_SIZE, loaded), MAX_PER_PAGE)
      : COLUMN_PAGE_SIZE
    const result = await fetchColumn(status, 0, perPage)
    columns[status].items = result.items
    columns[status].total = result.pagination.total
  }

  function reloadAll(keepLoaded = false) {
    return Promise.all(BOOK_STATUSES.map((s) => reloadColumn(s, keepLoaded)))
  }

  function hasMore(status: BookStatus): boolean {
    return columns[status].items.length < columns[status].total
  }

  // 読み込み済み件数を offset にして次の分を足す（カード移動で件数がずれても取りこぼさない）
  async function loadMore(status: BookStatus) {
    const column = columns[status]
    if (column.loadingMore || !hasMore(status)) return
    column.loadingMore = true
    try {
      const result = await fetchColumn(status, column.items.length, COLUMN_PAGE_SIZE)
      const loadedIds = new Set(column.items.map((b) => b.id))
      column.items.push(...result.items.filter((b) => !loadedIds.has(b.id)))
      column.total = result.pagination.total
    } finally {
      column.loadingMore = false
    }
  }

  function findBook(id: number): Book | undefined {
    for (const status of BOOK_STATUSES) {
      const book = columns[status].items.find((b) => b.id === id)
      if (book) return book
    }
    return undefined
  }

  // 楽観的更新：カードを to カラムの index へ移し、status・position・件数を反映する。
  // 戻り値は to カラムの新しい id 順（reorder API にそのまま渡す）
  function moveBook(book: Book, to: BookStatus, index: number): number[] {
    const from = columns[book.status]
    const target = columns[to]
    const fromIndex = from.items.findIndex((b) => b.id === book.id)
    if (fromIndex >= 0) from.items.splice(fromIndex, 1)
    if (book.status !== to) {
      from.total -= 1
      target.total += 1
      book.status = to
    }
    target.items.splice(Math.min(index, target.items.length), 0, book)
    target.items.forEach((b, i) => {
      b.position = i
    })
    return target.items.map((b) => b.id)
  }

  return { columns, reloadColumn, reloadAll, hasMore, loadMore, findBook, moveBook }
}
