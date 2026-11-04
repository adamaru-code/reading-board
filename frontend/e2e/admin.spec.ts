// 管理（管理者だけ）：招待の発行と削除、招待リンクからの新規登録、管理者が発行したリンクでのパスワード再設定
import { test, expect, type Browser, type Page } from '@playwright/test'
import { E2E_NEW_EMAIL } from './support'

const dialog = (page: Page) => page.getByRole('dialog', { name: '管理' })

async function openAdmin(page: Page, tab: '招待' | 'ユーザー') {
  await page.goto('/')
  await page.getByRole('button', { name: '管理' }).click()
  await dialog(page).getByRole('tab', { name: tab }).click()
}

// ログインしていない、まっさらな窓（招待・再設定のリンクを受け取った人）
async function freshPage(browser: Browser) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  return context.newPage()
}

test('招待コードを発行して削除すると、一覧から消える', async ({ page }) => {
  await openAdmin(page, '招待')
  const codes = dialog(page).locator('.invitation-code')
  const before = await codes.count()
  await dialog(page).getByRole('button', { name: '＋ 招待コードを発行' }).click()
  await expect(codes).toHaveCount(before + 1)

  const code = (await codes.first().textContent())!.trim()
  await dialog(page)
    .locator('.invitation', { hasText: code })
    .getByRole('button', { name: '削除' })
    .click()
  await expect(dialog(page).locator('.invitation-code', { hasText: code })).toHaveCount(0)
})

test('招待リンクから登録でき、管理者が発行した再設定リンクで新しいパスワードを設定できる', async ({
  page,
  browser,
}) => {
  // 管理者が招待コードを発行する
  await openAdmin(page, '招待')
  await dialog(page).getByRole('button', { name: '＋ 招待コードを発行' }).click()
  const code = (await dialog(page).locator('.invitation-code').first().textContent())!.trim()

  // 招待された人が、まっさらな窓でリンクを開いて登録する
  const guest = await freshPage(browser)
  await guest.goto(`/register?invite=${code}`)
  await expect(guest.getByLabel('招待コード')).toHaveValue(code)
  await guest.getByLabel('メールアドレス').fill(E2E_NEW_EMAIL)
  await guest.getByLabel(/パスワード（8/).fill('e2e-new-password-1')
  await guest.getByLabel('パスワード（確認）').fill('e2e-new-password-1')
  await guest.getByRole('button', { name: '登録してはじめる' }).click()
  await expect(guest).toHaveURL('/')
  await expect(guest.getByText(E2E_NEW_EMAIL)).toBeVisible()
  await guest.context().close()

  // 管理者の招待の一覧に「〜が登録」と出る
  await openAdmin(page, '招待')
  await expect(dialog(page).locator('.invitation', { hasText: code })).toContainText(
    `${E2E_NEW_EMAIL} が登録`,
  )

  // 管理者がユーザーの画面で、登録した人の再設定リンクを発行する
  await dialog(page).getByRole('tab', { name: 'ユーザー' }).click()
  const user = dialog(page).locator('.user', { hasText: E2E_NEW_EMAIL })
  await user.getByRole('button', { name: '再設定リンクを発行' }).click()
  const url = await user.getByLabel('再設定リンク').inputValue()
  expect(url).toContain('/reset?token=')

  // 登録した人が、まっさらな窓でリンクを開き、新しいパスワードを設定してログインする
  const owner = await freshPage(browser)
  await owner.goto(url)
  await expect(
    owner.getByText(`${E2E_NEW_EMAIL} の新しいパスワードを設定してください`),
  ).toBeVisible()
  await owner.getByLabel(/新しいパスワード（8/).fill('e2e-new-password-2')
  await owner.getByLabel('新しいパスワード（確認）').fill('e2e-new-password-2')
  await owner.getByRole('button', { name: '設定してログイン' }).click()
  await expect(owner).toHaveURL('/')
  await expect(owner.getByText(E2E_NEW_EMAIL)).toBeVisible()
  await owner.context().close()
})
