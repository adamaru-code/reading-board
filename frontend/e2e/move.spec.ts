// カードの移動（ドラッグ・Option ＋ 矢印キー）。読み込み直しても並びが残る（＝保存されている）かまで確かめる
import { test, expect, type Page } from '@playwright/test'
import { createBook, deleteAllBooks, uniqueTitle } from './support'

const titlesIn = (page: Page, status: string) =>
  page.locator(`section[data-status="${status}"] .card-title`)

let A: string, B: string, C: string

// 毎回、「読みたい」に A・B・C の 3 冊だけがある状態から始める
test.beforeEach(async ({ page }) => {
  await deleteAllBooks(page.request)
  ;[A, B, C] = [uniqueTitle('E2E-A'), uniqueTitle('E2E-B'), uniqueTitle('E2E-C')]
  const ids = []
  for (const title of [A, B, C]) ids.push((await createBook(page.request, { title })).id)
  await page.request.patch('/api/books/reorder', { data: { ids } })
  await page.goto('/')
  await expect(titlesIn(page, 'want_to_read')).toHaveText([A, B, C])
})

test('Option ＋ ▲ で段の中を 1 つ上へ、Option ＋ ▶ で右の段へ移り、読み込み直しても残る', async ({
  page,
}) => {
  const cardB = page.locator('.card', { hasText: B })
  await cardB.focus()

  await page.keyboard.press('Alt+ArrowUp')
  await expect(titlesIn(page, 'want_to_read')).toHaveText([B, A, C])
  // 動かしたあともフォーカスは同じカードにあり、結果が読み上げ用の欄に入る（#361）
  await expect(cardB).toBeFocused()
  await expect(page.locator('[aria-live="assertive"]')).toHaveText(
    `「${B}」を 読みたい の 1 番目に移しました`,
  )

  await page.keyboard.press('Alt+ArrowRight')
  await expect(titlesIn(page, 'want_to_read')).toHaveText([A, C])
  await expect(titlesIn(page, 'reading')).toHaveText([B])

  await page.reload()
  await expect(titlesIn(page, 'want_to_read')).toHaveText([A, C])
  await expect(titlesIn(page, 'reading')).toHaveText([B])
})

test('ドラッグで別の段へ移し、読み込み直しても残る', async ({ page }) => {
  await page.locator('.card', { hasText: C }).dragTo(page.locator('section[data-status="reading"]'))

  await expect(titlesIn(page, 'reading')).toHaveText([C])
  await expect(titlesIn(page, 'want_to_read')).toHaveText([A, B])
  await page.reload()
  await expect(titlesIn(page, 'reading')).toHaveText([C])
})
