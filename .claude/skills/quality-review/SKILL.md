---
name: quality-review
description: reading-board プロジェクトのコードレビュー / PR 前セルフチェック / 全体品質監査の観点を集約したチェックリスト。Backend（Rails API）・Frontend（Vue 3 + TS）・Docs・Terraform（IaC）・PR フローの 5 領域を網羅する。「品質チェック」「レビューして」「PR 出す前に確認」「ベストプラクティスに沿っているか」といった話題で発動。
---

# 品質レビュー チェックポイント

このプロジェクトの **コードレビュー / PR 前セルフチェック / 全体品質監査** で使う観点集。
変更を加える前後、PR を作る前、第三者のコードを読む時に、該当章を上から順に当てて評価する。

> 大規模監査時の進め方: 「Backend → Frontend → Docs → Terraform → PR フロー」の順で各章を点検し、
> 違反箇所をファイル: 行番号付きで列挙する。修正は CLAUDE.md のフロー（Issue → Branch → PR）に従って分割する。

---

## 1. Backend（Rails API）

### 1.1 責務分離 / Fat Controller 回避

- [ ] **Controller は薄く**保つ（複雑な業務ロジックはモデルのメソッド、または Service オブジェクトへ）
- [ ] **Strong Parameters**（`params.require(...).permit(...)`）で mass assignment を防いでいる
- [ ] クエリは **N+1 を回避**（`includes` / `eager_load`）

なぜ: テストしやすさ・責務分離。Controller に業務ロジックを積むと肥大化し再利用も効かない。

### 1.2 モデル / バリデーション

- [ ] バリデーションを**モデルに定義**（`presence` / `inclusion` / `numericality` / `length` 等）
- [ ] `status` のような列挙値は **enum または `inclusion`** で許容値を制約
- [ ] マイグレーションと `schema.rb` が整合（`bin/rails db:migrate` 済み・未コミットの schema 差分なし）
- [ ] DB 制約（NOT NULL / index）も適切に付与（アプリ側 validation だけに頼らない）

### 1.3 トランザクション境界

- [ ] **複数レコードを更新する処理（カンバンの reorder 等）は `ActiveRecord::Base.transaction` で囲む**
- [ ] 途中失敗で DB が中間状態にならないことを担保

### 1.4 例外ハンドリング / エラーレスポンス

- [ ] `rescue_from` 等で例外を適切な HTTP ステータスに変換
  - `ActiveRecord::RecordNotFound` → **404**
  - `ActiveRecord::RecordInvalid` / バリデーション失敗 → **422**（`{ "errors": {...} }`）
  - 不正 JSON / パラメータ不足 → **400**
- [ ] エラーレスポンスは**統一形**（例: `{ "errors": { field: [msg] } }`）
- [ ] レスポンス形を変える時はフロント（`frontend/src/api/books.ts`）への影響を確認

### 1.5 REST API 設計

- [ ] `resources` ルーティングを基本とし、HTTP メソッドの意味が正しい（GET/POST/PATCH/PUT/DELETE）
- [ ] ステータスコードが適切（**201** Created / **204** No Content / 400 / 404 / 422）
- [ ] URI は名詞・複数形（`/api/books`。操作的なものは `/api/books/reorder` のように許容）
- [ ] `render json:` に適切な `status:` を明示

### 1.6 セキュリティ / 設定

- [ ] 秘密情報（DB パスワード・APIキー）を**コードに直書きしない**（`Rails.application.credentials` または環境変数）
- [ ] **CORS（`rack-cors`）は `http://localhost:5173` のみ許可**（ワイルドカード `*` 禁止）
- [ ] `config/database.yml` の接続情報は環境変数化されている

### 1.7 Lint / テスト

- [ ] **RuboCop** が通る（導入時。`bundle exec rubocop`）
- [ ] テストが通る（`bin/rails test` または RSpec）
- [ ] マイグレーションは可逆（`change` で書けない場合は `up`/`down`）

---

## 2. Frontend（Vue 3 + TypeScript）

### 2.1 型の健全性

- [ ] `any` を使っていない（やむを得ない箇所は `unknown` + 型ガード）
- [ ] コンポーネントの **props / emits に型**が定義されている（`defineProps<...>()` / `defineEmits<...>()`）
- [ ] API レスポンスは `types/` の型に寄せる

### 2.2 リアクティビティ / Composition API

- [ ] **`<script setup>` + Composition API** を基本にしている
- [ ] `ref` / `reactive` / `computed` を適切に使い分け（派生値は `computed`）
- [ ] CRUD 等の再利用ロジックは **composable（`useBooks` 等）**に抽出する候補
- [ ] 楽観的更新を入れた箇所は、API 失敗時のロールバック（更新前の値を退避）が実装されている

### 2.3 描画 / a11y

- [ ] `v-for` の **`:key` は安定した一意 id**（配列インデックスではなく `book.id`）
- [ ] クリッカブル要素は `button` を使う（`div` の場合は `role` / `tabindex` / `@keydown`）
- [ ] フォーム要素に `label` が紐付いている

### 2.4 エラー / ローディング表現

- [ ] fetch のエラーが画面に表示される
- [ ] ローディング中の表示がある
- [ ] バリデーションエラー（Backend からの 422 + `errors`）がフォームに反映される

### 2.5 スタイル / 一貫性

- [ ] スタイルの当て方が無秩序に混在していない（scoped CSS / ユーティリティの方針が一貫）
- [ ] 命名（コンポーネント PascalCase / 関数・変数 camelCase / 型 PascalCase）が一貫

### 2.6 Lint / 型チェック / Build

- [ ] `npm run build`（`vue-tsc` の型チェック含む）が成功
- [ ] Lint 導入時は `npm run lint` 成功

---

## 3. Docs（要件定義・画面設計・データ定義）

`docs/` 配下のドキュメントは「実装を正」とする。実装変更時は併せて更新する。

- [ ] **API 一覧（`docs/data-definition.md`）が `Api::BooksController` のエンドポイントと一致**
  - 新規エンドポイントを追加したら、メソッド・パス・リクエスト/レスポンス例を追記
- [ ] **画面設計（`docs/screen-design.md`）の主要コンポーネント名 / UI 要素配置が実装と一致**
- [ ] **ユースケース（`docs/use-cases.md`）の基本フローが実装挙動と一致**
- [ ] データモデル（`docs/data-definition.md` の ER 図・列挙値）が **`Book` モデル / migration** と一致
- [ ] バリデーションルールがモデルの validation と一致
- [ ] README から docs への相対リンクが壊れていない

確認方法:
```bash
grep -rn "data-definition\|screen-design\|use-cases" docs/ README.md
```

---

## 4. Terraform / インフラ（IaC）

`infra/` 配下の Terraform コードを点検する（AWS デプロイのステージで使用）。構成・設計方針の全体像は `docs/infrastructure.md` を正とする。

### 4.1 フォーマット / 構文

- [ ] **`terraform fmt -check`** が通る（崩れていれば `terraform fmt`）
- [ ] **`terraform validate`** が通る（構文・参照の妥当性）
- [ ] リソース定義に無効・未使用の変数や重複がない

確認方法:
```bash
cd infra && terraform fmt -check && terraform validate
```

### 4.2 シークレット / state 管理

- [ ] **機密（DB パスワード・APIキー等）を `.tf` に直書きしていない**（`variable` + `terraform.tfvars`）
- [ ] 機密変数に **`sensitive = true`** が付いている
- [ ] **`terraform.tfvars` / `*.tfstate` が `.gitignore` 済み**でコミットされていない

### 4.3 セキュリティ設計（ネットワーク）

- [ ] セキュリティグループの ingress を**最小化**（`0.0.0.0/0` の無闇な開放をしない）
- [ ] SSH(22) や管理系ポートは**自 IP 等に限定**
- [ ] DB(RDS/MySQL) は **`publicly_accessible = false`**・**プライベートサブネット**・許可元は **SG 参照**
- [ ] アプリ内部ポート（例: Rails/Puma 3000）を不要に外部公開していない

### 4.4 変数・出力・可読性

- [ ] 固定値・環境依存値は **`variable` 化**し `description` を付けている
- [ ] `outputs` に接続先など必要な値を出す（機密は `sensitive = true`）
- [ ] リソース名・タグの**命名規則**が一貫し、ファイルが役割ごとに分割されている

### 4.5 コスト / ライフサイクル

- [ ] 学習用途では**最小インスタンス**（無料枠狙い）を選択している
- [ ] `terraform destroy` で確実に消える設定
- [ ] 「使わないときは destroy する」運用が README 等に明記されている

### 4.6 ドキュメント整合

- [ ] 構成を変えたら `docs/infrastructure.md` / `infra/README.md` を更新
- [ ] **変わりやすい詳細値（IP・エンドポイント・パスワード等）をドキュメントに固定書きしていない**

---

## 5. PR フロー（CLAUDE.md §1〜§7 準拠）

- [ ] Issue を立ててから着手している（`gh issue create`）
- [ ] ブランチ命名が `<type>/<issue#>-<short-desc>` に従っている
- [ ] コミットメッセージが Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:` / `refactor:` / `test:`）+ 日本語本文
- [ ] PR 本文に `Closes #<issue#>` が含まれる
- [ ] PR テンプレ（`.github/pull_request_template.md`）に沿っている
- [ ] フォーマッタによる一括変更は **別コミット** に分けている
- [ ] 1 PR = 1 トピック。複数トピックを混ぜていない
- [ ] マージは squash + branch 削除（`gh pr merge --squash --delete-branch`）

---

## レビューの進め方（推奨）

1. **PR 単位ならまず差分のスコープを確認** — 関係ないファイルが混ざっていれば指摘
2. **Backend / Frontend / Docs / Terraform / PR フロー** の章を順番に当てる
3. 違反箇所は `file:line` 形式で列挙し、修正は影響範囲ごとに別 Issue/PR へ分割
4. 「指摘 → ユーザー判断 → 必要なら実装」の順で進める。勝手に大規模リファクタしない

## 関連

- プロジェクト規約: [CLAUDE.md](../../../CLAUDE.md)
- ポート規約: [enforce-default-ports](../enforce-default-ports/SKILL.md)
