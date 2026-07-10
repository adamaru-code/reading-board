# 読書管理アプリ — データベース設計

> この文書は [要件定義書（概要）](requirements.md) から分割した詳細ドキュメントです。
> データモデル（テーブル・カラム・enum）を定義します。実装は [schema.rb](../backend/db/schema.rb) に準拠します。
> ER 図・将来の拡張（認証導入時）は [基本設計（図）](basic-design.md) を参照してください。

関連：[機能要件](functional-requirements.md) / [画面設計](screen-design.md) / [技術スタック](tech-stack.md)

---

## 1. Book

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

---

## 2. status enum（Rails `enum`）

| 値（Vue/API） | 整数 | 表示（カラム名） |
|---|---|---|
| `want_to_read` | 0 | 読みたい |
| `reading` | 1 | 読書中 |
| `read` | 2 | 読了 |

API のリクエスト/レスポンスでは文字列値（`want_to_read` など）でやり取りする（[機能要件](functional-requirements.md) §3 参照）。
