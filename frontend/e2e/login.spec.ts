// ログインとログアウト。保存したログイン状態は使わず、まっさらな窓で始める
// （ここでログアウトしても、ほかのテストのログイン状態は消えない。ログインは 1 回ごとに別に作られる）
import { test, expect } from '@playwright/test'
import { E2E_EMAIL, login } from './support'

test.use({ storageState: { cookies: [], origins: [] } })

test('ログインしていなければログイン画面へ。違うパスワードは断られる', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/login')

  await page.getByLabel('メールアドレス').fill(E2E_EMAIL)
  await page.getByLabel('パスワード').fill('wrong-password')
  await page.getByRole('button', { name: 'ログイン' }).click()

  await expect(page.getByRole('alert')).toHaveText('メールアドレスまたはパスワードが違います')
  await expect(page).toHaveURL('/login')
})

test('ログインするとボードが出て、ログアウトするとログイン画面に戻る', async ({ page }) => {
  await login(page, E2E_EMAIL, process.env.E2E_PASSWORD!)

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: '読みたい' })).toBeVisible()
  await expect(page.getByText(E2E_EMAIL)).toBeVisible()

  await page.getByRole('button', { name: 'ログアウト' }).click()
  await expect(page).toHaveURL('/login')
  // ログアウトしたあとはボードを開けない
  await page.goto('/')
  await expect(page).toHaveURL('/login')
})
