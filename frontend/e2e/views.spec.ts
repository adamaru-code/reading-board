// 絞り込み・読了一覧・統計。下準備の本は API で作る（画面で確かめたいのは表示と絞り込みのほう）
import { test, expect, type Page } from '@playwright/test'
import { createBook, deleteAllBooks, uniqueTitle } from './support'

const titlesIn = (page: Page, status: string) =>
  page.locator(`section[data-status="${status}"] .card-title`)

let want: string, reading: string, read1: string, read2: string

// 毎回、読みたい 1 冊・読書中 1 冊・読了 2 冊（どれも今日読了）だけがある状態から始める
test.beforeEach(async ({ page }) => {
  await deleteAllBooks(page.request)
  want = uniqueTitle('E2E-いぬ')
  reading = uniqueTitle('E2E-ねこ')
  read1 = uniqueTitle('E2E-読了1')
  read2 = uniqueTitle('E2E-読了2')
  await createBook(page.request, { title: want })
  await createBook(page.request, { title: reading, status: 'reading' })
  await createBook(page.request, { title: read1, author: 'E2E 著者', status: 'read' })
  await createBook(page.request, { title: read2, author: 'E2E 著者', status: 'read' })
})

test('キーワードで絞り込むと当てはまる本だけが残り、「✕ クリア」で戻る', async ({ page }) => {
  await page.goto('/')
  await expect(titlesIn(page, 'want_to_read')).toHaveText([want])

  await page.getByRole('searchbox', { name: 'タイトル・著者・メモで絞り込み' }).fill('E2E-ねこ')
  await expect(titlesIn(page, 'reading')).toHaveText([reading])
  await expect(titlesIn(page, 'want_to_read')).toHaveCount(0)
  await expect(page.locator('section[data-status="want_to_read"]')).toContainText(
    '当てはまる本はありません',
  )

  await page.getByRole('button', { name: '絞り込みをクリア' }).click()
  await expect(page.getByRole('searchbox', { name: 'タイトル・著者・メモで絞り込み' })).toHaveValue(
    '',
  )
  await expect(titlesIn(page, 'want_to_read')).toHaveText([want])
  await expect(titlesIn(page, 'read')).toHaveCount(2)
})

test('読了一覧に読了の本が並び、今年・今月の読了冊数が出る', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '読了一覧' }).click()
  await expect(page).toHaveURL('/read')

  // 同じ日に読了した本の並び順には頼らず、2 冊とも出ていることを確かめる
  const list = page.getByRole('region', { name: '読了' })
  await expect(list.locator('.row-title')).toHaveCount(2)
  await expect(list).toContainText(read1)
  await expect(list).toContainText(read2)
  await expect(list).toContainText('今年 2 冊・今月 2 冊')
})

test('統計に、選んでいる年の読了冊数と月ごとのグラフが出る', async ({ page }) => {
  await page.goto('/stats')
  await expect(page.getByText(/\d{4}年の読了 2 冊/)).toBeVisible()
  await expect(page.getByRole('heading', { name: /月ごとの読了冊数/ })).toBeVisible()
  // よく読んだ著者（#376）：同じ著者の 2 冊
  await expect(page.getByRole('heading', { name: /よく読んだ著者/ })).toBeVisible()
  await expect(page.getByLabel('E2E 著者 2冊')).toBeVisible()
  // 取れなかったときのお知らせ（role="alert"）は出ない
  await expect(page.getByRole('alert')).toHaveCount(0)
})
