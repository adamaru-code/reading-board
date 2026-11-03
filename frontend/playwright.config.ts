import { defineConfig } from '@playwright/test'
import { STORAGE_STATE } from './e2e/support'

// E2E テスト：本物のブラウザ（手元・CI に入っている Chrome）で、本物のアプリ
// （Vite 5173 → Rails 3000 → MySQL 3306）を人と同じように操作して確かめる。
// サーバーは先に起動しておく（CLAUDE.md §8 のポート。別のポートでは立ち上げない）。
// E2E 専用のアカウント（e2e@example.com）は global-setup で作り直し、global-teardown で本ごと消す
export default defineConfig({
  testDir: './e2e',
  // 同じアカウント・同じ DB を使うので、1 つずつ順に流す
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
    // Playwright のブラウザを別にダウンロードせず、入っている Chrome を使う
    channel: 'chrome',
    // 失敗したときだけ、操作の記録（trace）と画面の写真を test-results/ に残す
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // 最初に 1 回だけログインし、ログイン状態（Cookie）を保存する（ログインは 3 分に 10 回までの制限があるため）
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chrome',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: STORAGE_STATE },
    },
  ],
})
