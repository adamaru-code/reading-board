# プロジェクト規約（Claude Code 厳守）

このファイルは、Claude Code がこのリポジトリで作業する際に**必ず**従うルールを定めています。
ユーザーが明示的に「このルールを破って」と指示しない限り、例外は認めません。

**このプロジェクトは読書管理アプリ（Trello 風カンバン）です。** バックエンド Ruby on Rails（API モード）+
フロントエンド Vue 3（Vite/TypeScript, SPA）+ DB MySQL の構成で開発します。

---

## 1. 開発ワークフロー（必須順序）

すべての変更は次の順序で進めます：

```
Issue 作成 → Branch 作成 → 実装 → Push → Pull Request → セルフマージ → Branch 削除
```

### NG 行為（禁止）

- ❌ **`main` ブランチへの直接コミット・直接 push**
- ❌ **Issue を立てずにブランチを切る**
- ❌ **PR を作らずにマージする**
- ❌ **`main` への force push、`main` の削除**

例外: `CLAUDE.md` 自体のタイポ修正など、ユーザーが「直接でいい」と明示した場合のみ。
判断に迷ったら必ずユーザーに確認すること。

---

## 2. Issue を作る

実装に取りかかる前に、必ず Issue を立てます。

```bash
gh issue create --title "<簡潔な要約>" --body "<本文>"
```

- タイトルは命令形・簡潔に（例: `Add POST /api/books endpoint`）
- 本文は `.github/ISSUE_TEMPLATE/` のテンプレートに沿う
- ラベルは付けなくて良い

---

## 3. ブランチを作る

### 命名規則

```
<type>/<issue#>-<short-desc>
```

- `<type>`: `feature` | `fix` | `docs` | `chore` | `refactor` | `test`
- `<issue#>`: 上で作った Issue の番号（必須）
- `<short-desc>`: ハイフン区切りの英小文字（3〜5語）

例:
- `feature/12-add-book-create-endpoint`
- `fix/15-status-validation-message`

### 作成手順

```bash
git checkout main
git pull origin main
git checkout -b feature/12-add-book-create-endpoint
```

---

## 4. 実装〜コミット

### コミットメッセージのフォーマット

**Conventional Commits 形式**で、説明部分は日本語で記述する：

```
<type>: <日本語の説明>
```

- `<type>` は英語の小文字。`feat` / `fix` / `docs` / `chore` / `refactor` / `test` のいずれか
- 1 行目（要約）は簡潔に。50〜70文字程度を目安に
- 詳細が必要なら 2 行目を空けて 3 行目以降に書く
- Co-Authored-By タグを末尾に付ける（Claude が手を動かしたコミットの場合）

### type の対応関係（コミット ↔ ブランチ）

| 用途 | コミット type | ブランチ type |
|---|---|---|
| 新機能 | `feat` | `feature` |
| バグ修正 | `fix` | `fix` |
| ドキュメント | `docs` | `docs` |
| 雑務 | `chore` | `chore` |
| リファクタ | `refactor` | `refactor` |
| テスト | `test` | `test` |

---

## 5. Pull Request を作る

```bash
git push -u origin <branch-name>
gh pr create --title "<title>" --body "..." --base main
```

- PR 本文には **`Closes #<issue#>`** を必ず含める
- `.github/pull_request_template.md` のテンプレートに沿う
- レビュー承認は不要（セルフマージ可）

---

## 6. マージ〜後始末

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull origin main
```

- マージ方式: **squash merge** を基本とする
- マージ後は **必ずブランチを削除**（`--delete-branch`）
- ローカル main を最新化して次の作業に入る

---

## 7. 自動的に守るために

「実装して」「修正して」と頼まれたら、**Issue → Branch → PR** のフローを自動的に開始すること。
「コミットして」と言われた場合も、現在のブランチを確認し、main にいるなら必ず作業ブランチに切り替えてから進めること。

---

## 8. ローカルサーバーの起動ポート（厳守）

ローカル開発時、サーバーは **必ず以下のデフォルトポート** で起動すること。
別ポートでの一時起動は禁止（プロキシ・CORS 設定が固定ポート前提で動かないため）。

| サーバー | 必須ポート |
|---|---|
| Backend (Rails API) | **3000** |
| Frontend (Vite) | **5173** |
| MySQL (Docker) | **3306** |

### 起動前チェック

サーバーを起動する前に、必ずポート使用状況を確認する：

```bash
lsof -i :3000
lsof -i :5173
```

- 既存プロセスがいれば `kill <PID>` で停止してから起動する
- Vite が自動で 5174 等にフォールバックした場合は、即座に停止し 5173 を空けてからやり直す
- 何のプロセスかわからない場合は、勝手に停止せず**ユーザーに確認**する

### 関連設定（固定ポート前提）

- バックエンドの CORS は `http://localhost:5173` のみ許可（`backend/config/initializers/cors.rb`）
- フロントの Vite プロキシは `/api → http://localhost:3000`（`frontend/vite.config.ts`）

### 起動手順

```bash
docker compose up -d                      # MySQL(3306) を起動
cd backend && bin/rails server            # Rails API を 3000 で起動
cd frontend && npm run dev                # Vite を 5173 で起動
```

Ruby 環境は **mise** で管理（`ruby 3.3.x`）。`mise` が有効なシェルで作業すること。

---

## 参考: プロジェクト固有情報

- **GitHub リポジトリ**: https://github.com/adamaru-code/reading-board
- **デフォルトブランチ**: `main`
- **技術スタック**: Rails 8（API）/ Vue 3 + Vite + TypeScript / MySQL 8 / mise(Ruby 3.3)
- **設計ドキュメント**: [docs/](docs/)
- **ローカル起動手順**: [README.md](README.md) 参照
