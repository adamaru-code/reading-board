# 読書管理アプリ — 基本設計（画面遷移・ER・データフロー）

[要件定義書（概要）](requirements.md) と各詳細ドキュメントを土台に、実装に向けた **How** を図で整理する。
図は GitHub 上で描画される [Mermaid](https://mermaid.js.org/) 記法で記述している。

対応関係：[機能要件](functional-requirements.md)（ユースフロー・API）・[画面設計](screen-design.md)（画面仕様）・
[データベース設計](database-design.md)（データモデル）を、本書で「遷移／構造／流れ」の観点から図示する。

---

## 1. システム構成

フロント（Vue SPA）は Vite の開発プロキシ経由で Rails API を呼び、Rails は ActiveRecord で MySQL にアクセスする。
ポートは固定（[CLAUDE.md](../CLAUDE.md) §8）。

```mermaid
flowchart LR
    Browser["ブラウザ<br/>Vue 3 SPA"] -->|"/api/* リクエスト"| Proxy["Vite Dev Server<br/>:5173"]
    Proxy -->|"REST / JSON"| API["Rails API<br/>:3000"]
    API -->|"ActiveRecord"| DB[("MySQL<br/>:3306")]
    API -.->|"JSON レスポンス"| Proxy
    Proxy -.-> Browser
```

- フロントは `/api/*` を叩くだけで、プロキシが `http://localhost:3000` に転送する（CORS/ポート差異を吸収）。
- 本番構成では Vite プロキシの代わりに Web サーバ/リバースプロキシが同じ役割を担う想定。

---

## 2. 画面遷移図

画面は [画面設計](screen-design.md) の S1〜S4。ボードを中心に、追加/編集はモーダルで開いて閉じると戻る。

```mermaid
flowchart TD
    S1["S1 カンバンボード<br/>（メイン画面）"]
    S3["S3 追加フォーム<br/>（モーダル）"]
    S4["S4 編集フォーム<br/>（モーダル）"]

    S1 -->|"＋追加"| S3
    S3 -->|"保存 / キャンセル"| S1
    S1 -->|"カードをクリック"| S4
    S4 -->|"更新 / 削除 / キャンセル"| S1
    S1 -->|"カードを別カラムへドラッグ<br/>（status 更新・画面は留まる）"| S1
```

- 画面遷移の実体は 1 画面（SPA）で、S3/S4 はモーダルの開閉。
- カード移動はページ遷移せず、その場で状態更新して再描画する。

---

## 3. ER 図

`books` を中心に、タグ（多対多）と状態イベント（日付履歴）を持つ（[データベース設計](database-design.md) に準拠）。

```mermaid
erDiagram
    books ||--o{ book_tags : "has"
    tags ||--o{ book_tags : "has"
    books ||--o{ book_status_events : "logs"
    books {
        bigint id PK "主キー"
        string title "NOT NULL, 書名"
        string author "NULL可, 著者"
        int status "NOT NULL default 0, enum(0:読みたい/1:読書中/2:読了)"
        int rating "NULL可, 0-5, 評価"
        text memo "NULL可, 感想"
        string isbn "NULL可, ISBN/JAN"
        int genre "NOT NULL default 4, enum(0-4 主ジャンル)"
        int media_type "NOT NULL default 0, enum(0:書籍/1:雑誌)"
        int position "NULL可, カラム内並び順"
        datetime created_at "NOT NULL"
        datetime updated_at "NOT NULL"
    }
    tags {
        bigint id PK
        string name "NOT NULL UNIQUE, タグ名"
    }
    book_tags {
        bigint id PK
        bigint book_id FK "books"
        bigint tag_id FK "tags"
    }
    book_status_events {
        bigint id PK
        bigint book_id FK "books"
        int status "NOT NULL, 入った状態"
        date occurred_on "NOT NULL, 入った日"
        datetime created_at "NOT NULL"
    }
```

- 所要日数（開始→読了）は `book_status_events` から算出し、保存しない。
- 認証導入時は `books` に `user_id` を追加（§3.1）。

### 3.1 将来の拡張（認証導入時）

[要件定義書](requirements.md) §4（将来拡張候補）の通り、将来的に単一ユーザー認証を追加する場合は `users` を追加し、
`books` に `user_id` を持たせて 1 対多で紐づける想定（本フェーズでは未実装）。

```mermaid
erDiagram
    users ||--o{ books : "owns"
    users {
        bigint id PK
        string email "ログイン ID"
    }
    books {
        bigint id PK
        bigint user_id FK "所有者（将来追加）"
        string title
    }
```

---

## 4. データフロー

### 4.1 一覧表示（画面初期化）

```mermaid
sequenceDiagram
    participant U as 利用者
    participant V as Vue SPA
    participant R as Rails API
    participant D as MySQL
    U->>V: ボードを開く
    V->>R: GET /api/books
    R->>D: SELECT * FROM books
    D-->>R: 全書籍
    R-->>V: 200 [books...]
    V-->>U: status ごとに 3 カラムへ振り分けて表示
```

### 4.2 カード移動＝ステータス変更（カンバンの中心操作）

```mermaid
sequenceDiagram
    participant U as 利用者
    participant V as Vue SPA
    participant R as Rails API
    participant D as MySQL
    U->>V: カードを「読書中」へドラッグ
    V->>R: PATCH /api/books/1 { status: "reading" }
    R->>D: UPDATE books SET status=1 WHERE id=1
    R->>D: INSERT book_status_events (book_id=1, status=1, occurred_on=today)
    D-->>R: OK
    R-->>V: 200 { id:1, status:"reading", status_dates:{...}, ... }
    V-->>U: カードを移動先カラムに再描画（日付・所要日数を反映）
    Note over V,R: 失敗時(422/404)は元のカラムに戻し、エラー表示
    Note over R,D: 状態に入った日を履歴として記録（同一状態・同一日は重複記録しない）
```

### 4.3 登録 / 編集 / 削除

| 操作 | 画面 | API | DB |
|---|---|---|---|
| 登録 | S3 追加フォーム | POST /api/books（種別・タグ含む） | INSERT（+ book_tags / status_event） |
| 編集（評価・メモ・種別・タグ含む） | S4 編集フォーム | PATCH /api/books/:id | UPDATE（+ book_tags 同期） |
| 削除 | S4 編集フォーム | DELETE /api/books/:id | DELETE |
| 一覧絞り込み | S1 ヘッダ | GET /api/books?status=&genre=&author=&tag= | SELECT（AND 条件） |

### 4.4 ISBN/バーコードから登録

```mermaid
sequenceDiagram
    participant U as 利用者
    participant V as Vue SPA
    participant O as 書誌API(openBD)
    U->>V: ISBN入力 or バーコード読取
    V->>O: GET /v1/get?isbn=<code>
    O-->>V: 書誌(タイトル/著者/書影) or null
    alt 書籍(978/979)で取得成功
        V-->>U: タイトル・著者を自動補完 / 形態=書籍
    else 雑誌(491)・該当なし・失敗
        V-->>U: 手入力にフォールバック（コードは保持）
    end
    Note over V,O: 本番はバックエンドが openBD をプロキシする案（キャッシュ/CORS 回避）
```

---

## 5. 画面の構成要素と対応 API

各画面（[画面設計](screen-design.md)）が使う API・データの対応。

| 画面/要素 | 主な構成要素 | 使う API | 備考 |
|---|---|---|---|
| S1 カンバンボード | 3 カラム（件数付き見出し）、カードリスト、追加ボタン、絞り込み（著者/ジャンル/タグ）、読了の並び替え | GET /api/books?status=&genre=&author=&tag= | 絞り込みは AND。並び替えはクライアント側でも可 |
| S2 書籍カード | ジャンル/雑誌バッジ、タイトル・著者・★・タグ・日付・所要日数、ドラッグ操作 | PATCH /api/books/:id | ドラッグで status 更新＋状態イベント記録 |
| S3 追加フォーム | ISBN/バーコード登録、タイトル(必須)・著者・初期ステータス・ジャンル・形態・タグ・タグ提案、保存/キャンセル | GET /api/books/lookup、POST /api/books | 成功で該当カラムに追加 |
| S4 編集フォーム | 全項目入力（種別・タグ含む）、更新/削除/キャンセル | PATCH・DELETE /api/books/:id | 削除は確認の上 |

---

## 6. フロントの状態管理方針（概要）

- ボードは取得した書籍配列を保持し、`status` でグルーピングして 3 カラムに描画する。
- カード移動・登録・編集・削除の後は、レスポンスを反映してカラム表示を更新する（楽観的更新＋失敗時ロールバックも可）。
- API クライアントは `/api` を基点に CRUD をまとめる（実装ステップは [要件定義書](requirements.md) §5-4 で作成）。

> 詳細なバリデーション仕様・コンポーネント分割・状態管理ライブラリの要否は、
> 各実装ステップ（[要件定義書](requirements.md) §5 実装の分割方針）で詰める。
