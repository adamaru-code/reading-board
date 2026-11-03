# backend（Rails 8 API モード）

読書管理アプリの API。起動のしかた・テスト・全体の構成は、リポジトリの [README](../README.md) を見てください。

| フォルダ | 中身 |
|---|---|
| `app/controllers/api/` | API（`/api/*`）。一覧は [機能要件](../docs/functional-requirements.md) §3 |
| `app/models/` | 本・タグ・状態の履歴・ユーザー・招待・ISBN で調べた結果のキャッシュなど |
| `app/services/` | 外部 API（openBD・Google Books）・CSV の書き出し / 読み込み・表紙のまとめて取得・タグの管理 |
| `config/locales/ja.yml` | 画面に出す日本語のメッセージ |
| `db/` | マイグレーション・`schema.rb`・初期データ（`seeds.rb`） |
| `test/` | minitest（`bin/rails test`） |

DB の設計は [データベース設計](../docs/database-design.md) を見てください。
