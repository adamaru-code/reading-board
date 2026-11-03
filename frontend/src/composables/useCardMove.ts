// ボードのカードの移動：ドラッグ＆ドロップと、キーボード（Option ＋ 矢印キー）。どちらも moveTo で移して保存する。
// KanbanBoard.vue から分けた（#370）
import { ref, nextTick, onBeforeUnmount } from 'vue'
import { updateBook, reorderBooks } from '../api/books'
import { ApiError } from '../api/http'
import { STATUS_LABELS } from '../types/book'
import type { Book, BookStatus } from '../types/book'
import type { ColumnState } from './useKanbanColumns'
import { keyboardMoveTarget, type MoveDirection } from '../lib/keyboardMove'

export interface CardMoveDeps {
  columns: Record<BookStatus, ColumnState>
  findBook: (id: number) => Book | undefined
  // カードを移して status と position をローカルに反映し、移した先の段の本の id を並び順で返す（useKanbanColumns）
  moveBook: (book: Book, status: BookStatus, index: number) => number[]
  reloadColumn: (status: BookStatus, keepLoaded?: boolean) => Promise<void>
  // 401 なら true を返してログイン画面へ戻す
  onAuthError: (e: unknown) => boolean
  // 保存に失敗したとき：メッセージを出し、サーバーから取り直して元へ戻す
  onMoveFailed: (message: string) => void
}

const ANNOUNCE_DELAY_MS = 200

export function useCardMove(deps: CardMoveDeps) {
  const { columns, findBook, moveBook, reloadColumn, onAuthError, onMoveFailed } = deps

  // ---------- ドラッグ&ドロップ ----------
  const draggingId = ref<number | null>(null)
  // ドラッグ直後に発火する click を抑止するためのフラグ
  let justDragged = false

  function onDragStart(event: DragEvent, book: Book) {
    draggingId.value = book.id
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(book.id))
    }
  }

  function onDragEnd() {
    draggingId.value = null
    justDragged = true
    setTimeout(() => {
      justDragged = false
    }, 0)
  }

  // ドラッグを放した直後のクリックか（カードを開かないようにする）
  function wasJustDragged() {
    return justDragged
  }

  // index：落とされたカラム内の位置（KanbanColumn が移動中のカードを除いて数える）
  async function onDrop(status: BookStatus, index: number) {
    const id = draggingId.value
    draggingId.value = null
    if (id === null) return

    const book = findBook(id)
    if (!book) return
    await moveTo(book, status, index)
  }

  // ---------- キーボード（Option ＋ 矢印キー） ----------
  // 結果は画面に出さない読み上げ用のお知らせ（aria-live）で伝える。
  // お知らせの場所は最初から置いておく（後から出した aria-live の欄は読まれないことがある）
  const moveMessage = ref('')
  let announceTimer: ReturnType<typeof setTimeout> | undefined
  onBeforeUnmount(() => clearTimeout(announceTimer))

  async function onCardMove(book: Book, direction: MoveDirection) {
    const items = columns[book.status].items
    const target = keyboardMoveTarget(
      book.status,
      items.findIndex((b) => b.id === book.id),
      items.length,
      direction,
    )
    if ('blocked' in target) {
      announce(target.blocked)
      return
    }
    const moved = await moveTo(book, target.status, target.index)
    if (!moved) return
    // 並び替えでカードの部品が置き直されるとフォーカスが外れるので、同じ本のカードへ戻す（続けて動かせるように）
    await nextTick()
    document.querySelector<HTMLElement>(`.card[data-book-id="${book.id}"]`)?.focus()
    const position =
      target.status === 'read' ? '' : ` の ${columns[target.status].items.indexOf(book) + 1} 番目`
    announce(`「${book.title}」を ${STATUS_LABELS[target.status]}${position}に移しました`)
  }

  // 同じ文を続けて伝えても読まれるよう、一度空にしてから入れる。
  // フォーカスをカードへ戻すと VoiceOver はまず「〇〇 を編集」を読むので、少し待ってから入れ、
  // すぐ読む欄（aria-live="assertive"）で割り込ませる（控えめな role="status" だと読まれなかった。#360 の画面確認）
  function announce(message: string) {
    moveMessage.value = ''
    clearTimeout(announceTimer)
    announceTimer = setTimeout(() => {
      moveMessage.value = message
    }, ANNOUNCE_DELAY_MS)
  }

  // ---------- 共通：移して保存する ----------
  // 本を status の段の index 番目へ移し、サーバーへ保存する。移せたら true
  async function moveTo(book: Book, status: BookStatus, index: number): Promise<boolean> {
    const id = book.id
    const statusChanged = book.status !== status
    // 読了カラムはキー（読了日など）で並べるため手動並び替えの対象外
    const sortedByKey = status === 'read'
    if (sortedByKey && !statusChanged) return false

    // 楽観的更新：カードを移して status と position をローカルに反映（失敗時はサーバーから再取得）。
    // reorder には読み込み済みの分だけ渡す（残りはサーバーが既存順で後ろに詰める）
    const targetIds = moveBook(book, status, index)

    try {
      if (statusChanged) await updateBook(id, { status })
      if (sortedByKey) {
        await reloadColumn(status, true) // キー順の正しい位置に置き直す
      } else {
        await reorderBooks(targetIds)
      }
    } catch (e) {
      if (onAuthError(e)) return false
      onMoveFailed(
        e instanceof ApiError
          ? e.message
          : '並び替えに失敗しました。時間をおいて再度お試しください。',
      )
      return false
    }
    return true
  }

  return { draggingId, onDragStart, onDragEnd, wasJustDragged, onDrop, moveMessage, onCardMove }
}
