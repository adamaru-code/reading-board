// 本の追加・編集・削除。画面で操作し、読み込み直しても（＝DB に保存されていても）そのとおりかを確かめる
import { test, expect, type Page } from '@playwright/test'
import { deleteAllBooks, uniqueTitle } from './support'

const wantColumn = (page: Page) => page.locator('section[data-status="want_to_read"]')
const card = (page: Page, title: string) => page.locator('.card', { hasText: title })
// 開いている画面（モーダル）の中だけを探す。ボードの上のキーワード欄（「タイトル・著者・メモで絞り込み」）や
// タグ候補のボタン（「〇〇をタグに追加」）にも「タイトル」「追加」が入っているので、ボタンは名前がぴったり同じものだけ
const dialog = (page: Page) => page.getByRole('dialog')
const button = (page: Page, name: string) => dialog(page).getByRole('button', { name, exact: true })

async function addBook(page: Page, title: string) {
  await page.getByRole('button', { name: '＋ 本を追加' }).click()
  await dialog(page).getByLabel('タイトル').fill(title)
  await button(page, '追加').click()
  await expect(dialog(page)).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await deleteAllBooks(page.request)
  await page.goto('/')
})

test('本を追加すると「読みたい」にカードが出て、読み込み直しても残る', async ({ page }) => {
  const title = uniqueTitle('E2E 追加')
  await page.getByRole('button', { name: '＋ 本を追加' }).click()
  await expect(page.getByRole('dialog', { name: '書籍を追加' })).toBeVisible()
  // 開いたらタイトル欄にカーソルがある（#357）
  await expect(dialog(page).getByLabel('タイトル')).toBeFocused()
  await dialog(page).getByLabel('タイトル').fill(title)
  await dialog(page).getByLabel('著者').fill('E2E 著者')
  await button(page, '追加').click()

  await expect(dialog(page)).toBeHidden()
  await expect(wantColumn(page).locator('.card', { hasText: title })).toContainText('E2E 著者')
  await page.reload()
  await expect(wantColumn(page).locator('.card', { hasText: title })).toBeVisible()
})

test('カードを開いて題名を変えると、カードの題名も変わる', async ({ page }) => {
  const before = uniqueTitle('E2E 編集前')
  const after = uniqueTitle('E2E 編集後')
  await addBook(page, before)

  await card(page, before).click()
  await expect(page.getByRole('dialog', { name: '書籍を編集' })).toBeVisible()
  await dialog(page).getByLabel('タイトル').fill(after)
  await button(page, '更新').click()

  await expect(dialog(page)).toBeHidden()
  await expect(card(page, after)).toBeVisible()
  await expect(card(page, before)).toHaveCount(0)
  await page.reload()
  await expect(card(page, after)).toBeVisible()
})

test('削除は確認してから消え、「キャンセル」なら消えない', async ({ page }) => {
  const title = uniqueTitle('E2E 削除')
  await addBook(page, title)

  // 確認ダイアログで「キャンセル」→ 消えない
  await card(page, title).click()
  await button(page, '削除').click()
  const confirm = page.getByRole('alertdialog', { name: '本を削除しますか？' })
  await expect(confirm.getByRole('button', { name: 'キャンセル' })).toBeFocused()
  await confirm.getByRole('button', { name: 'キャンセル' }).click()
  await expect(confirm).toBeHidden()

  // もう一度「削除」→ 確認で「削除」→ 消える
  await button(page, '削除').click()
  await confirm.getByRole('button', { name: '削除', exact: true }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(card(page, title)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: '読みたい' })).toBeVisible()
  await expect(card(page, title)).toHaveCount(0)
})
