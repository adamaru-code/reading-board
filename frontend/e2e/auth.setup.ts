// 最初に 1 回だけ、E2E 専用のアカウントでログインし、ログイン状態（Cookie）を保存する。
// ほかのテストはこの状態を使い回すので、ログインの回数制限（3 分に 10 回）に当たらない
import { test as setup, expect } from '@playwright/test'
import { E2E_EMAIL, STORAGE_STATE, login } from './support'

setup('E2E 専用のアカウントでログインし、ログイン状態を保存する', async ({ page }) => {
  await login(page, E2E_EMAIL, process.env.E2E_PASSWORD!)

  await expect(page).toHaveURL('/')
  await expect(page.getByText(E2E_EMAIL)).toBeVisible()
  await page.context().storageState({ path: STORAGE_STATE })
})
