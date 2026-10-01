# 読書管理アプリ — 技術スタック

> この文書は [要件定義書（概要）](requirements.md) から分割した詳細ドキュメントです。
> 採用技術とその選定理由、開発環境をまとめます。
> ポート・Docker/mise などローカル運用ルールは [CLAUDE.md](../CLAUDE.md) §8 が正とします。

関連：[機能要件](functional-requirements.md) / [画面設計](screen-design.md) / [データベース設計](database-design.md)

---

## 1. 技術選定

| 層 | 採用技術 | 選定理由 |
|---|---|---|
| バックエンド | Ruby on Rails 8（API モード） | 学習対象（RaiseTech）。CRUD・enum・バリデーションなどを規約に沿って高い生産性で実装でき、API 専用構成で軽量 |
| フロントエンド | Vue 3 + Vite + TypeScript（SPA） | カンバンのような動的 UI に適する。TS で型安全、Vite で高速な開発体験。学習対象 |
| データベース | MySQL 8 | 広く使われる RDB で情報が豊富。Docker でローカル環境を容易に再現できる |
| API 通信 | REST / JSON | シンプルで学習向き。今回の規模では GraphQL 等はオーバースペック |
| 開発環境 | Docker（MySQL）/ mise（Ruby 3.3）/ 固定ポート | ローカル再現性を確保。ポートは Backend 3000 / Frontend 5173 / MySQL 3306 に固定（[CLAUDE.md](../CLAUDE.md) §8） |
| 外部サービス | openBD（書誌：タイトル・著者）／Google Books の Books API（書影：表紙画像の URL） | どちらも無料。openBD は鍵なし。Google Books は無料の API キー（開発は `backend/mise.local.toml`、本番は SSM）。表紙は openBD に無い本が多く、国立国会図書館の書影 API は 2026-03-31 に終了したため Google Books にした。どちらもバックエンドから呼び、鍵を画面側に出さない |
| 認証 | Rails 8 標準の `has_secure_password`（bcrypt）＋セッション Cookie | 追加 gem なしで実装でき、パスワード再設定トークン・回数制限（`rate_limit`）も標準機能で賄える |
| テスト | minitest（backend）/ vitest ＋ @vue/test-utils（frontend） | Rails / Vite の標準的な選択。CI で PR ごとに実行 |
| lint・静的検査 | RuboCop（rubocop-rails-omakase）・Brakeman・bundler-audit / ESLint ＋ Prettier | Rails 8・create-vue の標準構成。書き方の揺れとセキュリティ上の問題を自動で検出 |
| CI | GitHub Actions | backend（テスト・lint・セキュリティ）・frontend（lint・テスト・ビルド）・Terraform（fmt・validate） |
| インフラ | AWS（EC2 ＋ RDS ＋ CloudFront）/ Terraform | 学習用に使うときだけ起動。構成・費用は [インフラ設計](infrastructure.md) |

---

## 2. システム構成

構成図（フロント → Vite プロキシ → Rails API → MySQL）と各層の役割は [基本設計（図）](basic-design.md) §1 を参照。AWS 上の構成は [インフラ設計](infrastructure.md) §2。

---

## 3. ビルド・依存管理

### フロントエンド（Vue 3 + TypeScript）

ビルドツールは **Vite 8**（`@vitejs/plugin-vue`）。画面の切り替えは **vue-router 4**（`src/router/index.ts`。URL ごとに画面を持ち、ログイン状態をナビゲーションガードで確認）。コマンドは `frontend/package.json` の scripts に定義。

| コマンド | 内容 | 用途 |
|---|---|---|
| `npm run dev` | Vite Dev Server を :5173 で起動 | ローカル開発（`/api` プロキシ含む） |
| `npm run build` | `vue-tsc -b`（型チェック）→ `vite build`（バンドル） | 本番ビルド。成果物は `frontend/dist/` に出力 |
| `npm run preview` | ビルド成果物をローカル配信 | 本番ビルドの動作確認 |
| `npm test` | vitest でテストを実行 | 開発・CI |
| `npm run lint` | ESLint で書き方をチェック（`lint:fix` で自動修正） | 開発・CI |
| `npm run format` | Prettier で整形（`format:check` は確認のみ） | 開発・CI（CI は確認のみ） |

### バックエンド（Rails 8 API モード）

**ビルド工程なし**。API モードのためアセットパイプライン（Sprockets / jsbundling 等）は使用しない。

- 依存管理: **Bundler**（`backend/Gemfile`）
- セットアップ: `bundle install` → `bin/rails server` で起動（ポートは [CLAUDE.md](../CLAUDE.md) §8 参照）
- チェック: `bin/rails test`・`bin/rubocop`・`bin/brakeman`・`bin/bundler-audit`（まとめて `bin/ci` でも実行可）
- 時刻: アプリの「今日」・時刻は日本時間（`config.time_zone = "Tokyo"`）。DB への保存は UTC（Rails の標準）。API の日時は `+09:00` 付きで返す
- 本番: `backend/Dockerfile`（Rails 8 標準）でコンテナ化。秘密鍵は `SECRET_KEY_BASE` 環境変数（[インフラ設計](infrastructure.md) §1.1）
