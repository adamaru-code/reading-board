# 読書管理アプリ — 要件定義・設計

Trello 風カンバンで書籍を「読みたい / 読書中 / 読了」の 3 カラム管理するアプリの
要件定義・設計をまとめる。技術スタックは [CLAUDE.md](../CLAUDE.md) 参照（Rails 8 API / Vue 3 / MySQL 8）。

> 本書は初版のたたき台。フィールド名や enum 値など「決め事」は §2・§3 の表に明示しており、
> レビューで調整可能。確定後にこの前置きを削除する。

---

## 1. 要件

### 1.1 機能要件

| ID | 要件 |
|---|---|
| F1 | 書籍を登録・一覧表示・編集・削除できる（CRUD） |
| F2 | カンバンのカラム移動で書籍のステータスを変更できる（読みたい → 読書中 → 読了、逆方向も可） |
| F3 | 書籍に評価（★1〜5）を記録できる |
| F4 | 書籍に感想メモを記録できる |

### 1.2 非機能・前提

- SPA（Vue 3）+ REST API（Rails, JSON）構成。認証は本フェーズでは扱わない（単一ユーザー前提）。
- ローカルポートは Backend 3000 / Frontend 5173 / MySQL 3306 を厳守（[CLAUDE.md](../CLAUDE.md) §8）。

---

## 2. データモデル

### Book

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | bigint | PK, auto | 主キー |
| `title` | string | NOT NULL | 書名（必須） |
| `author` | string | NULL 可 | 著者名 |
| `status` | integer(enum) | NOT NULL, default: `want_to_read` | 状態（下記 enum） |
| `rating` | integer | NULL 可, 0〜5 | 評価（★）。0/未設定は評価なし |
| `memo` | text | NULL 可 | 感想メモ |
| `position` | integer | NULL 可 | カラム内の並び順（将来の並べ替え用） |
| `created_at` | datetime | NOT NULL | 作成日時 |
| `updated_at` | datetime | NOT NULL | 更新日時 |

### status enum（Rails `enum`）

| 値（Vue/API） | 整数 | 表示（カラム名） |
|---|---|---|
| `want_to_read` | 0 | 読みたい |
| `reading` | 1 | 読書中 |
| `read` | 2 | 読了 |

### バリデーション

- `title`: 必須、1〜255 文字
- `status`: enum のいずれか（デフォルト `want_to_read`）
- `rating`: 未設定 or 0〜5 の整数

---

## 3. API 仕様（REST / JSON）

ベースパス `/api`。フロントの Vite プロキシで `/api → http://localhost:3000` に転送される。

| メソッド | パス | 用途 | 主なステータス |
|---|---|---|---|
| GET | `/api/books` | 一覧取得（status で絞り込み可: `?status=reading`） | 200 |
| GET | `/api/books/:id` | 詳細取得 | 200 / 404 |
| POST | `/api/books` | 新規作成 | 201 / 422 |
| PATCH | `/api/books/:id` | 更新（ステータス変更・評価・メモ含む） | 200 / 404 / 422 |
| DELETE | `/api/books/:id` | 削除 | 204 / 404 |

### リクエスト/レスポンス例

作成リクエスト（POST /api/books）:

```json
{ "book": { "title": "リーダブルコード", "author": "Dustin Boswell", "status": "want_to_read" } }
```

レスポンス（201）:

```json
{
  "id": 1,
  "title": "リーダブルコード",
  "author": "Dustin Boswell",
  "status": "want_to_read",
  "rating": null,
  "memo": null,
  "position": 1,
  "created_at": "2026-07-06T12:00:00Z",
  "updated_at": "2026-07-06T12:00:00Z"
}
```

エラー（422）:

```json
{ "errors": { "title": ["can't be blank"] } }
```

---

## 4. 画面構成（フロントエンド）

| 画面/要素 | 内容 |
|---|---|
| カンバンボード | 「読みたい / 読書中 / 読了」の 3 カラムを横並び表示 |
| 書籍カード | タイトル・著者・★評価を表示。カラム間で移動可能 |
| 追加フォーム | タイトル・著者・初期ステータスを入力して登録 |
| 編集フォーム | 既存書籍の各フィールド（評価・メモ含む）を編集・削除 |

### ステータス遷移（F2）

```
[読みたい] ⇄ [読書中] ⇄ [読了]
```

カード移動 = 該当書籍の `status` を PATCH で更新する。遷移方向の制約は設けない（任意のカラムへ移動可）。

---

## 5. 実装の分割方針（今後の Issue 粒度）

1. **Backend: Book モデル + マイグレーション + enum**（DB スキーマ確定）
2. **Backend: /api/books CRUD エンドポイント + シリアライズ + バリデーション**
3. **Backend: リクエストスペック（テスト）**
4. **Frontend: API クライアント + 型定義**
5. **Frontend: カンバンボード表示（一覧・カラム分け）**
6. **Frontend: 追加/編集フォーム + カラム移動でのステータス更新**

各ステップを 1 Issue = 1 PR とし、本書の該当セクションを参照する。
