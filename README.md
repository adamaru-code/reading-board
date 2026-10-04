# reading-board — 読書管理アプリ（Trello 風カンバン）

読みたい / 読書中 / 読了 の 3 カラムで書籍を視覚的に管理する、Trello 風のカンバンボードアプリ。
RaiseTech の学習成果物として、**Ruby on Rails（API）+ Vue 3 + MySQL** のフルスタック構成で開発する。

## 主要機能

- 書籍の登録・表示・編集・削除（CRUD）。ISBN 入力・バーコード読取で書誌を自動入力（openBD）、表紙画像も表示（Google Books）
- カンバンのドラッグでステータス変更（読みたい ⇄ 読書中 ⇄ 読了）とカラム内の並び替え
- 評価（★1〜5）・感想メモ・主ジャンル・形態・タグ（候補の提案つき）
- 各状態に入った日（日本時間）と読了までの日数の記録、読了カラムの並び替え、キーワード（タイトル・著者）・ジャンル・タグでの絞り込み
- カラムごとのページング（20 件＋「もっと見る」）、読了本を 1 冊 1 行で並べる読了一覧（`/read`）
- 統計（`/stats`）：今年・今月・これまでの読了冊数、月ごと・ジャンル別のグラフ（年を切り替えられる）
- CSV 書き出し・読み込み（アカウント画面）：自分の本を CSV で保存し、CSV からまとめて登録
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

エディタは VS Code / Cursor を想定。リポジトリを開くと右下に**おすすめの拡張機能**（Terraform・Vue・Ruby LSP・ESLint・Prettier・日本語化）の案内が出るので、インストールするとファイルが色分けされる（一覧は [.vscode/extensions.json](.vscode/extensions.json)。拡張機能画面で `@recommended` と検索しても出る）。

```bash
# 1. MySQL(Docker) を起動
docker compose up -d

# 2. バックエンド（Rails API, :3000）
cd backend
bundle install                           # 初回と、Gemfile が変わったとき（Ruby の部品を入れる）
bin/rails db:create db:migrate db:seed   # 初回のみ（seed で初期ユーザー＝管理者とデモ用の本を作成）
bin/rails server

# 3. フロントエンド（Vite, :5173）※別ターミナル
cd frontend
npm install                      # 初回のみ
npm run dev
```

ブラウザで `http://localhost:5173` を開き、seed の初期ユーザー `owner@example.com` / `ReadingBoard-dev-2026!` でログインする（`SEED_USER_EMAIL` / `SEED_USER_PASSWORD` で変更可）。`/api/*` は Vite プロキシ経由で Rails(3000) に転送される。

### 書影（表紙画像）を開発で出すとき（任意）

表紙は Google Books から取得する。API キー（`GOOGLE_BOOKS_API_KEY`）が無くてもアプリは動く（表紙が出ないだけ）。
毎回鍵を入れなくて済むよう、Git に入らない mise の個人用設定（`backend/mise.local.toml`）に置く。

```bash
# 1. 鍵を画面に出さずに読み込む（Google Cloud の「認証情報」でコピーした鍵を貼り付けて Enter）
read -s "GOOGLE_BOOKS_API_KEY?鍵を貼り付けて Enter（画面には表示されません）: " && export GOOGLE_BOOKS_API_KEY && echo ""
# 2. mise の個人用設定に書く（.gitignore 済み）
printf '[env]\nGOOGLE_BOOKS_API_KEY = "%s"\n' "$GOOGLE_BOOKS_API_KEY" > backend/mise.local.toml
# 3. 初回だけ、この設定ファイルを信頼する（mise の決まり）
cd backend && mise trust mise.local.toml
# 4. Rails を起動し直す（起動中なら Ctrl+C で止めてから）
bin/rails server
```

本番（AWS）の鍵の置き方は [AWS 手順書](docs/aws-deploy-guide.md) の 5.6。

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
