# frontend（Vue 3 + Vite + TypeScript）

読書管理アプリの画面（SPA）。起動のしかた・テスト・全体の構成は、リポジトリの [README](../README.md) を見てください。

| フォルダ | 中身 |
|---|---|
| `src/components/` | 画面の部品（ボード・カード・モーダル・統計など） |
| `src/composables/` | 画面の状態と処理のまとまり（カラムごとの本・絞り込み・統計・カードの移動） |
| `src/api/` | Rails API を呼ぶ関数（`http.ts` の `request` が基点） |
| `src/lib/` | 画面に依存しない処理（ログイン状態・タグ提案・フォーカスの閉じ込め・キーボードでの移動など） |
| `src/types/` | API の JSON に合わせた型 |
| `src/router/` | URL と画面の対応（vue-router） |
| `src/**/__tests__/` | vitest のテスト（`npm test`） |
| `e2e/` | Playwright の E2E テスト（`npm run test:e2e`。MySQL・Rails・Vite を先に起動する） |

設計は [画面設計](../docs/screen-design.md)・[基本設計](../docs/basic-design.md) を見てください。
