// CSV の書き出しと読み込み（アカウント →「CSV」タブ）
import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { createBook, deleteAllBooks, uniqueTitle } from './support'

async function openCsvTab(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'アカウント' }).click()
  await page.getByRole('tab', { name: 'CSV' }).click()
}

test.beforeEach(async ({ page }) => {
  await deleteAllBooks(page.request)
})

test('書き出した CSV に、見出しと自分の本が入っている', async ({ page }) => {
  const title = uniqueTitle('E2E-書き出し')
  await createBook(page.request, { title, status: 'reading' })
  await openCsvTab(page)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'CSV で書き出す' }).click()
  const download = await downloadPromise
  const csv = await readFile(await download.path(), 'utf8')

  expect(csv).toContain('タイトル,著者,状態')
  expect(csv).toContain(`${title},,読書中`)
})

test('CSV を読み込むと、確認（足す冊数）のあと「取り込む」で本が増える', async ({ page }) => {
  const title = uniqueTitle('E2E-読み込み')
  await openCsvTab(page)

  await page.getByLabel('CSV ファイルを選ぶ').setInputFiles({
    name: 'books.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`タイトル,著者,状態\n${title},E2E 著者,読書中\n`),
  })
  // 確認：まだ取り込まない
  await expect(page.locator('.import-preview')).toContainText('1 冊を新しく足します')

  await page.getByRole('button', { name: '取り込む' }).click()
  await expect(page.getByRole('status').filter({ hasText: '冊を取り込みました' })).toHaveText(
    '1 冊を取り込みました。',
  )

  await page.getByRole('button', { name: '閉じる' }).click()
  await expect(
    page.locator('section[data-status="reading"] .card', { hasText: title }),
  ).toContainText('E2E 著者')
})
