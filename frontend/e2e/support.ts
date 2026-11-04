// E2E テストで共通に使う値と道具
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))

// E2E 専用のアカウント（管理者。招待・ユーザーの画面も使う）。開発用 DB のほかのアカウント（owner など）には触れない
export const E2E_EMAIL = 'e2e@example.com'
// 招待リンクからの新規登録で作るアカウント（admin.spec.ts）。global-setup・global-teardown で消す
export const E2E_NEW_EMAIL = 'e2e-new@example.com'
// E2E が作るアカウント全部を消す Ruby（global-setup・global-teardown で使う）
export const DESTROY_E2E_USERS = `User.where(email: ["${E2E_EMAIL}", "${E2E_NEW_EMAIL}"]).find_each(&:destroy!)`
// ログイン状態（Cookie）の保存先。.gitignore 済み
export const STORAGE_STATE = path.join(here, '.auth', 'user.json')

const BACKEND_DIR = path.resolve(here, '..', '..', 'backend')

// backend で bin/rails runner を動かす（E2E 専用のアカウントを作る・消す）。値は環境変数で渡す
export function railsRunner(code: string, env: Record<string, string> = {}): string {
  return execFileSync('bin/rails', ['runner', code], {
    cwd: BACKEND_DIR,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
}

// ログイン画面でログインする。ログインは 3 分に 10 回までの制限があり（総当たり対策）、E2E は 1 回流すと 3 回使う。
// 制限に当たったら、何をすればよいかが分かる言葉で止める
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(email)
  await page.getByLabel('パスワード').fill(password)
  await page.getByRole('button', { name: 'ログイン' }).click()

  const alert = page.getByRole('alert')
  await expect(alert.or(page.getByRole('heading', { name: '読みたい' }))).toBeVisible()
  if ((await alert.count()) > 0 && (await alert.textContent())?.includes('試行回数が多すぎます')) {
    throw new Error(
      'ログインの回数制限（3 分に 10 回）に当たりました。3 分待つか、Rails を起動し直してから流してください',
    )
  }
}

// 流すたびに違う題名にする（前の失敗で残った本と混ざらないように）
export function uniqueTitle(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`
}

type BookInput = {
  title: string
  author?: string
  status?: 'want_to_read' | 'reading' | 'read'
  tags?: string[]
}
type BookJson = { id: number; title: string }

// API で本を作る（画面の操作を確かめたいテストの、下準備に使う）
export async function createBook(request: APIRequestContext, input: BookInput): Promise<BookJson> {
  const response = await request.post('/api/books', {
    data: { book: { status: 'want_to_read', genre: 'other', media_type: 'book', ...input } },
  })
  if (!response.ok()) throw new Error(`本を作れませんでした：${response.status()}`)
  return (await response.json()) as BookJson
}

// E2E 専用のアカウントの本をすべて消す（テストの最初に、前のテストの本を片付ける）
export async function deleteAllBooks(request: APIRequestContext): Promise<void> {
  const response = await request.get('/api/books', { params: { per_page: 100 } })
  const { items } = (await response.json()) as { items: BookJson[] }
  for (const book of items) await request.delete(`/api/books/${book.id}`)
}
