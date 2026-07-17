# 読書管理アプリ — データベース設計

> この文書は [要件定義書（概要）](requirements.md) から分割した詳細ドキュメントです。
> データモデル（テーブル・カラム・enum）を定義します。実装は [schema.rb](../backend/db/schema.rb) に準拠します。
> ER 図・将来の拡張（認証導入時）は [基本設計（図）](basic-design.md) を参照してください。

関連：[機能要件](functional-requirements.md) / [画面設計](screen-design.md) / [技術スタック](tech-stack.md)

---

> プロトタイプ（[`prototype/`](../prototype/)）で合意した種別（ジャンル・形態・タグ）・日付履歴・所要日数を反映したモデル。
> プロトタイプはインメモリのため、本番モデルでは「タグ＝多対多」「状態日付の履歴＝別テーブル」で表現する。

## 1. Book

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | bigint | PK, auto | 主キー |
| `title` | string | NOT NULL | 書名（必須） |
| `author` | string | NULL 可 | 著者名 |
| `status` | integer(enum) | NOT NULL, default: `want_to_read` | 状態（§2 enum） |
| `rating` | integer | NULL 可, 0〜5 | 評価（★）。0/未設定は評価なし |
| `memo` | text | NULL 可 | 感想メモ |
| `isbn` | string | NULL 可 | ISBN/JAN（コードから登録した場合に保持。13桁 or 変換後） |
| `genre` | integer(enum) | NOT NULL, default: `other` | 主ジャンル（単一。§3 enum） |
| `media_type` | integer(enum) | NOT NULL, default: `book` | 形態（書籍/雑誌。§4 enum） |
| `position` | integer | NULL 可 | カラム内の並び順（将来の並べ替え用） |
| `created_at` | datetime | NOT NULL | 作成日時 |
| `updated_at` | datetime | NOT NULL | 更新日時 |

- タグは多対多（§5）、状態に入った日付の履歴は別テーブル（§6）で表現する。
- 所要日数（開始→読了）は §6 のイベントから**算出**し、保存しない。

---

## 2. status enum（Rails `enum`）

| 値（Vue/API） | 整数 | 表示（カラム名） |
|---|---|---|
| `want_to_read` | 0 | 読みたい |
| `reading` | 1 | 読書中 |
| `read` | 2 | 読了 |

API のリクエスト/レスポンスでは文字列値（`want_to_read` など）でやり取りする（[機能要件](functional-requirements.md) §3 参照）。

---

## 3. genre enum（主ジャンル・単一）

| 値（Vue/API） | 整数 | 表示 |
|---|---|---|
| `classic_novel` | 0 | 古典・名作小説 |
| `liberal_arts` | 1 | 教養・人文・思想 |
| `health_body` | 2 | 健康・身体 |
| `practical` | 3 | 実用・暮らし |
| `other` | 4 | その他・未分類（既定） |

ジャンルの一覧は将来 UI で増減しうるが、当面はこの中分類を固定値とする。

---

## 4. media_type enum（形態・単一）

| 値（Vue/API） | 整数 | 表示 |
|---|---|---|
| `book` | 0 | 書籍（既定） |
| `magazine` | 1 | 雑誌 |

ISBN/JAN 登録時、`978`/`979` 始まりは `book`、`491` 始まり（定期刊行物）は `magazine` に自動判定する（[機能要件](functional-requirements.md) F6）。

---

## 5. Tag / BookTag（タグ・多対多）

タグは 1 冊に複数、複数の本で共有する。表記統一のため名称は一意にする。

`tags`

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | bigint | PK, auto | 主キー |
| `name` | string | NOT NULL, UNIQUE | タグ名（例: `名著` `入門` `再読したい`） |

`book_tags`（中間テーブル）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | bigint | PK, auto | 主キー |
| `book_id` | bigint | FK → books, NOT NULL | 書籍 |
| `tag_id` | bigint | FK → tags, NOT NULL | タグ |

- API では `tags: string[]`（名称配列）でやり取りし、サーバー側で `find_or_create` して紐づける。
- 簡易実装（多対多が過剰な場合）は `books.tags` を JSON/text カラムで持つ選択肢もあるが、絞り込み・集計のしやすさから多対多を基本とする。

---

## 6. BookStatusEvent（状態に入った日の履歴）

カラム移動のたびに「その状態に入った日」を 1 レコード記録する。プロトタイプで合意した
「日付は上書きでなく履歴として追加」を表現する。

`book_status_events`

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | bigint | PK, auto | 主キー |
| `book_id` | bigint | FK → books, NOT NULL | 書籍 |
| `status` | integer(enum) | NOT NULL | 入った状態（§2 enum） |
| `occurred_on` | date | NOT NULL | 入った日（日付のみ） |
| `created_at` | datetime | NOT NULL | 記録日時 |

- **導出値**：登録日＝最初の `want_to_read` / 開始日＝最初の `reading` / 読了日＝`read`（複数可）。
- **所要日数**＝（最初の `read` の `occurred_on`）−（最初の `reading` の `occurred_on`）。開始が無ければ非表示。
- 同一状態・同一日の重複は記録しない（プロトタイプ挙動に合わせる）。
- ※ 履歴が不要なら、代替として `books` に `want_to_read_at` / `reading_at` / `read_at` の 3 date カラムを持つ簡易案もある（再読・出戻りの履歴は表現できない）。
