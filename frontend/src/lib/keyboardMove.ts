// ボードのカードをキーボード（Option ＋ 矢印キー）で動かすときの行き先を決める。
// ▲▼：段の中を 1 つ上・下へ。◀▶：左・右の段の一番上へ。
// 読了の段は読了日などの順で並ぶので、段の中では動かさない（ドラッグと同じ決まり）
import { BOOK_STATUSES, type BookStatus } from '../types/book'

export type MoveDirection = 'up' | 'down' | 'left' | 'right'

// 動かせるときは行き先（段と、その段の何番目か。移すカード自身は数えない）、動かせないときは理由
export type MoveTarget = { status: BookStatus; index: number } | { blocked: string }

const KEY_DIRECTIONS: Record<string, MoveDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

// Option（Alt）＋ 矢印キーなら向き、それ以外は null
export function moveDirection(event: KeyboardEvent): MoveDirection | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null
  return KEY_DIRECTIONS[event.key] ?? null
}

// index：そのカードの今の段での位置。count：今の段に読み込み済みのカードの数
export function keyboardMoveTarget(
  status: BookStatus,
  index: number,
  count: number,
  direction: MoveDirection,
): MoveTarget {
  if (direction === 'up' || direction === 'down') {
    if (status === 'read')
      return { blocked: '読了の段は読了日などの順で並ぶため、並び替えできません' }
    const next = direction === 'up' ? index - 1 : index + 1
    if (next < 0) return { blocked: 'いちばん上です' }
    if (next >= count) return { blocked: 'いちばん下です' }
    return { status, index: next }
  }
  const next = BOOK_STATUSES[BOOK_STATUSES.indexOf(status) + (direction === 'left' ? -1 : 1)]
  if (!next)
    return {
      blocked: direction === 'left' ? 'これより左に段はありません' : 'これより右に段はありません',
    }
  return { status: next, index: 0 }
}
