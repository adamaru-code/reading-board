// モーダルの中に Tab の移動を閉じ込める（フォーカストラップ）。
// 最後の部品で Tab → 最初へ、最初の部品で Shift+Tab → 最後へ戻し、後ろの画面へ出ないようにする。
// 見えているかは見ない（モーダルの中には v-show などで隠した部品が無い前提。jsdom でも同じに動くように）
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
}

// Tab を自分で動かしたら true（呼び出し側はブラウザ標準の移動を止める）
export function trapTab(event: KeyboardEvent, container: HTMLElement): boolean {
  if (event.key !== 'Tab') return false
  const items = focusables(container)
  const active = document.activeElement
  // 外にいる・枠そのものにいる → 中の最初（Shift なら最後）へ
  if (items.length === 0 || !(active instanceof HTMLElement) || !container.contains(active)) {
    ;(event.shiftKey ? items.at(-1) : items[0])?.focus()
    return true
  }
  const first = items[0]!
  const last = items.at(-1)!
  if (event.shiftKey && (active === first || active === container)) {
    last.focus()
    return true
  }
  if (!event.shiftKey && (active === last || active === container)) {
    first.focus()
    return true
  }
  return false
}
