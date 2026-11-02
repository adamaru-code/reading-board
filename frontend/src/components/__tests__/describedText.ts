// 読み上げソフトが名前のあとに読む「説明」（aria-describedby が指す部品の文字）をテスト用に組み立てる。
// role="img" の部品（★の評価）は中の文字ではなく aria-label を読む。v-if で出ていない id は飛ばす
export function describedText(el: Element, root: Element): string {
  return (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => root.querySelector(`[id="${id}"]`))
    .filter((part): part is Element => part !== null)
    .map((part) =>
      part.getAttribute('role') === 'img'
        ? (part.getAttribute('aria-label') ?? '')
        : (part.textContent ?? '').replace(/\s+/g, ' ').trim(),
    )
    .filter((text) => text !== '')
    .join(' / ')
}
