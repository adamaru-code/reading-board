# reading-board — 読書管理アプリ（Trello 風カンバン）

読みたい / 読書中 / 読了 の 3 カラムで書籍を視覚的に管理する、Trello 風のカンバンボードアプリ。
RaiseTech の学習成果物として、**Ruby on Rails（API）+ Vue 3 + MySQL** のフルスタック構成で開発する。

## 主要機能

- 書籍の登録・表示・編集・削除（CRUD）。ISBN 入力・バーコード読取で書誌を自動入力（openBD）
- カンバンのドラッグでステータス変更（読みたい ⇄ 読書中 ⇄ 読了）とカラム内の並び替え
- 評価（★1〜5）・感想メモ・主ジャンル・形態・タグ（候補の提案つき）
- 各状態に入った日と読了までの日数の記録、読了カラムの並び替え、ジャンル・著者・タグでの絞り込み
- カラムごとのページング（20 件＋「もっと見る」）
- ログイン、招待制の新規登録、パスワード変更・管理者発行の再設定リンク・アカウント削除

詳細は [docs/requirements.md](docs/requirements.md) と [docs/functional-requirements.md](docs/functional-requirements.md)。

## 技術スタック

| 役割 | 技術 |
|---|---|
| バックエンド | Ruby on Rails 8（API モード）/ Ruby 3.3（mise 管理） |
| フロントエンド | Vue 3 + Vite + TypeScript（SPA） |
| データベース | MySQL 8（ローカルは Docker で起動） |
| API 通信 | REST API（JSON） |
| テスト・lint | minitest・RuboCop・Brakeman・bundler-audit / vitest・ESLint・Prettier |
| インフラ | AWS（EC2 ＋ RDS ＋ CloudFront）/ Terraform（[infra/README.md](infra/README.md)） |

## ローカル起動手順

> **ポートは厳守**: Backend **3000** / Frontend **5173** / MySQL **3306**（[CLAUDE.md §8](CLAUDE.md) 参照）

前提: mise（Ruby 3.3）・Node.js・Docker が利用できる状態。

```bash
# 1. MySQL(Docker) を起動
docker compose up -d

# 2. バックエンド（Rails API, :3000）
cd backend
bin/rails db:create db:migrate db:seed   # 初回のみ（seed で初期ユーザー＝管理者とデモ用の本を作成）
bin/rails server

# 3. フロントエンド（Vite, :5173）※別ターミナル
cd frontend
npm install                      # 初回のみ
npm run dev
```

ブラウザで `http://localhost:5173` を開き、seed の初期ユーザー `owner@example.com` / `ReadingBoard-dev-2026!` でログインする（`SEED_USER_EMAIL` / `SEED_USER_PASSWORD` で変更可）。`/api/*` は Vite プロキシ経由で Rails(3000) に転送される。

## テスト・チェック

```bash
cd backend && bin/rails test     # Rails（minitest）
cd backend && bin/rubocop        # Ruby の書き方チェック（rubocop-rails-omakase）
cd backend && bin/brakeman       # Rails のセキュリティ検査
cd backend && bin/bundler-audit  # gem の脆弱性検査
cd frontend && npm test          # Vue/TS（vitest）
cd frontend && npm run lint      # 書き方チェック（ESLint）
cd frontend && npm run format    # 見た目の自動整形（Prettier）。確認だけなら npm run format:check
```

CI（GitHub Actions）で PR ごとに上記すべてと `npm run build`・Terraform の fmt / validate を実行する。backend はまとめて `bin/ci` でも実行できる。

## ディレクトリ構成

```
reading-board/
├── backend/            Rails API（Ruby 3.3 / MySQL）
├── frontend/           Vue 3 + Vite + TypeScript
├── infra/              AWS の Terraform（使うときだけ起動）
├── docs/               設計・要件定義ドキュメント
├── prototype/          画面イメージのモック（HTML/CSS/JS）
├── docker-compose.yml  MySQL 8 のローカル起動設定
├── CLAUDE.md           開発ルール（Issue→Branch→PR / ポート規約）
└── README.md
```

## 開発ワークフロー

**Issue → Branch → PR → セルフマージ → Branch 削除** を厳守（詳細は [CLAUDE.md](CLAUDE.md)）。
