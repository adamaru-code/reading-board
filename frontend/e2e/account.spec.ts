// アカウント画面：パスワード変更・タグの管理
import { test, expect, type Page } from '@playwright/test'
import { E2E_EMAIL, createBook, deleteAllBooks, railsRunner, uniqueTitle } from './support'

const dialog = (page: Page) => page.getByRole('dialog', { name: 'アカウント' })

async function openAccount(page: Page, tab: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'アカウント' }).click()
  await dialog(page).getByRole('tab', { name: tab }).click()
}

// DB のパスワードがその文字列か（ログインの回数制限を使わずに確かめる）
const passwordIs = (password: string) =>
  railsRunner(`print User.find_by!(email: "${E2E_EMAIL}").authenticate(ENV.fetch("PW")).present?`, {
    PW: password,
  }) === 'true'

test('パスワードを変えられ、いまのログインはそのまま使える（変えたあと元に戻す）', async ({
  page,
}) => {
  const original = process.env.E2E_PASSWORD!
  const changed = `${original}-changed`
  await openAccount(page, 'パスワード変更')
  await dialog(page).getByLabel('現在のパスワード').fill(original)
  await dialog(page)
    .getByLabel(/新しいパスワード（8/)
    .fill(changed)
  await dialog(page).getByLabel('新しいパスワード（確認）').fill(changed)
  await dialog(page).getByRole('button', { name: '変更する' }).click()

  await expect(dialog(page).locator('.done-message')).toContainText('パスワードを変更しました')
  expect(passwordIs(changed)).toBe(true)

  // 変更しても、いまのログイン（ほかのテストも使う）は残る
  await page.reload()
  await expect(page.getByText(E2E_EMAIL)).toBeVisible()

  // 元に戻す（ほかのテストが E2E_PASSWORD でログインするため）
  const response = await page.request.patch('/api/password', {
    data: { current_password: changed, password: original, password_confirmation: original },
  })
  expect(response.status()).toBe(204)
  expect(passwordIs(original)).toBe(true)
})

test('違う「現在のパスワード」では変えられない', async ({ page }) => {
  await openAccount(page, 'パスワード変更')
  await dialog(page).getByLabel('現在のパスワード').fill('wrong-password')
  await dialog(page)
    .getByLabel(/新しいパスワード（8/)
    .fill('new-password-1')
  await dialog(page).getByLabel('新しいパスワード（確認）').fill('new-password-1')
  await dialog(page).getByRole('button', { name: '変更する' }).click()

  await expect(dialog(page).getByRole('alert')).toContainText('現在のパスワード')
  expect(passwordIs(process.env.E2E_PASSWORD!)).toBe(true)
})

test('タグの名前をほかのタグと同じにすると 1 つにまとまり、「外す」で本から外れる', async ({
  page,
}) => {
  await deleteAllBooks(page.request)
  const [a, b] = [uniqueTitle('E2Eタグa'), uniqueTitle('E2Eタグb')]
  await createBook(page.request, { title: uniqueTitle('E2E-本1'), tags: [a] })
  await createBook(page.request, { title: uniqueTitle('E2E-本2'), tags: [b] })
  await openAccount(page, 'タグ')

  const row = (name: string) => dialog(page).locator('.tag-row', { hasText: name })
  await row(a).getByRole('button', { name: '名前を変える' }).click()
  await dialog(page).getByLabel('新しい名前').fill(b)
  await expect(dialog(page).locator('.merge-note')).toContainText(
    `「${b}」（1 冊）と 1 つにまとめます。`,
  )
  await dialog(page).getByRole('button', { name: '変更', exact: true }).click()

  // 処理が終わる（お知らせが出る）のを待ってから行を見る。名前を変える欄の「『b』と 1 つにまとめます」にも b が入るため
  await expect(dialog(page).locator('.done-message')).toContainText(
    `「${a}」を「${b}」にまとめました`,
  )
  await expect(row(a)).toHaveCount(0)
  await expect(row(b)).toContainText('2 冊')

  await row(b).getByRole('button', { name: '外す' }).click()
  await page
    .getByRole('alertdialog', { name: 'タグを外しますか？' })
    .getByRole('button', { name: '外す' })
    .click()
  await expect(dialog(page)).toContainText('まだタグはありません。')

  // ボードのカードからもタグが消えている
  await dialog(page).getByRole('button', { name: '閉じる' }).click()
  await expect(page.locator('.card .tag-chip')).toHaveCount(0)
})
