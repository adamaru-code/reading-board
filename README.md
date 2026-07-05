# reading-board — 読書管理アプリ（Trello 風カンバン）

読みたい / 読書中 / 読了 の 3 カラムで書籍を視覚的に管理する、Trello 風のカンバンボードアプリ。
RaiseTech の学習成果物として、**Ruby on Rails（API）+ Vue 3 + MySQL** のフルスタック構成で開発する。

## 主要機能（予定）

- 書籍の登録・表示・編集・削除（CRUD）
- カンバンのカラム移動でステータス変更（読みたい → 読書中 → 読了）
- 評価（★1〜5）・感想メモの記録（拡張しやすいフィールド設計）

## 技術スタック

| 役割 | 技術 |
|---|---|
| バックエンド | Ruby on Rails 8（API モード）/ Ruby 3.3（mise 管理） |
| フロントエンド | Vue 3 + Vite + TypeScript（SPA） |
| データベース | MySQL 8（ローカルは Docker で起動） |
| API 通信 | REST API（JSON） |

## ローカル起動手順

> **ポートは厳守**: Backend **3000** / Frontend **5173** / MySQL **3306**（[CLAUDE.md §8](CLAUDE.md) 参照）

前提: mise（Ruby 3.3）・Node.js・Docker が利用できる状態。

```bash
# 1. MySQL(Docker) を起動
docker compose up -d

# 2. バックエンド（Rails API, :3000）
cd backend
bin/rails db:create db:migrate   # 初回のみ
bin/rails server

# 3. フロントエンド（Vite, :5173）※別ターミナル
cd frontend
npm install                      # 初回のみ
npm run dev
```

ブラウザで `http://localhost:5173` を開く。`/api/*` は Vite プロキシ経由で Rails(3000) に転送される。

## ディレクトリ構成

```
reading-board/
├── backend/            Rails API（Ruby 3.3 / MySQL）
├── frontend/           Vue 3 + Vite + TypeScript
├── docs/               設計・要件定義ドキュメント
├── docker-compose.yml  MySQL 8 のローカル起動設定
├── CLAUDE.md           開発ルール（Issue→Branch→PR / ポート規約）
└── README.md
```

## 開発ワークフロー

**Issue → Branch → PR → セルフマージ → Branch 削除** を厳守（詳細は [CLAUDE.md](CLAUDE.md)）。
