---
name: quality-review
description: reading-board プロジェクトのコードレビュー / PR 前セルフチェック / 全体品質監査の観点を集約したチェックリスト。Backend（Rails API）・Frontend（Vue 3 + TS）・Docs・Terraform（IaC）・PR フローの 5 領域を網羅する。「品質チェック」「レビューして」「PR 出す前に確認」「ベストプラクティスに沿っているか」といった話題で発動。
---

# 品質レビュー チェックポイント

このプロジェクトの **コードレビュー / PR 前セルフチェック / 全体品質監査** で使う観点集。
変更を加える前後、PR を作る前、第三者のコードを読む時に、該当章を上から順に当てて評価する。

> 大規模監査時の進め方: 「Backend → Frontend → Docs → Terraform → PR フロー」の順で各章を点検し、
> 違反箇所をファイル: 行番号付きで列挙する。修正は CLAUDE.md のフロー（Issue → Branch → PR）に従って分割する。
>
> まず自動チェックを一通り流して機械的な指摘を集め、そのあとコードとドキュメントを読んで「標準からのずれ」を探す：
>
> ```bash
> cd backend && bin/rails test && bin/rubocop && bin/brakeman --no-pager && bin/bundler-audit   # または bin/ci
> cd frontend && npm test && npm run lint && npm run format:check && npm run build
> cd infra && terraform fmt -check -recursive && terraform validate
> ```
>
> 作業の大きい改善（例：vue-router 導入・大きい部品の分割・I18n 化）は、その場で直さず GitHub Issue にして 1 つずつ進める（2026-09-26 の監査で登録済み：#158 vue-router・#159 部品分割と BaseModal・#160 I18n・#161 本番の config.hosts）。

---

## 1. Backend（Rails API）

### 1.1 責務分離 / Fat Controller 回避

- [ ] **Controller は薄く**保つ（複雑な業務ロジックはモデルのメソッド、または Service オブジェクトへ）
- [ ] **Strong Parameters** で mass assignment を防いでいる。Rails 8 では **`params.expect(book: [...])`** が標準（形が違えば 400。`require(...).permit(...)` は旧来の書き方）
- [ ] クエリは **N+1 を回避**（`includes` / `eager_load`）

なぜ: テストしやすさ・責務分離。Controller に業務ロジックを積むと肥大化し再利用も効かない。

### 1.2 モデル / バリデーション

- [ ] バリデーションを**モデルに定義**（`presence` / `inclusion` / `numericality` / `length` 等）
- [ ] `status` のような列挙値は **enum または `inclusion`** で許容値を制約。enum は **`validate: true`** を付け、不正値を例外ではなく検証エラー（422）にする（`rescue_from ArgumentError` で受けるのは、関係のないバグまで 422 にしてしまうので避ける）
- [ ] マイグレーションと `schema.rb` が整合（`bin/rails db:migrate` 済み・未コミットの schema 差分なし）
- [ ] DB 制約（NOT NULL / index）も適切に付与（アプリ側 validation だけに頼らない）

### 1.3 トランザクション境界

- [ ] **複数レコードを更新する処理は `ActiveRecord::Base.transaction` で囲む**か、reorder のように **1 本の SQL（`update_all` ＋ CASE 式）**にまとめる
- [ ] 途中失敗で DB が中間状態にならないことを担保

### 1.4 例外ハンドリング / エラーレスポンス

- [ ] `rescue_from` 等で例外を適切な HTTP ステータスに変換（広すぎる例外クラスは捕まえない）
  - `ActiveRecord::RecordNotFound` → **404**
  - バリデーション失敗 → **422**
  - 不正 JSON / パラメータ不足（`ActionController::ParameterMissing`）→ **400**（Rails が自動で返す）
- [ ] エラーレスポンスは**このプロジェクトの統一形 `{ "errors": ["メッセージ", ...] }`**（文字列の配列。フロントの `ApiError` がこの形を前提にしている）
- [ ] ユーザーに見えるメッセージは日本語に揃える（モデルの検証メッセージは英語のまま＝I18n 化は #160）
- [ ] レスポンス形を変える時はフロント（`frontend/src/api/books.ts`）への影響を確認

### 1.5 REST API 設計

- [ ] `resources` ルーティングを基本とし、HTTP メソッドの意味が正しい（GET/POST/PATCH/PUT/DELETE）
- [ ] ステータスコードが適切（**201** Created / **204** No Content / 400 / 404 / 422）
- [ ] URI は名詞・複数形（`/api/books`。操作的なものは `/api/books/reorder` のように許容）
- [ ] `render json:` に適切な `status:` を明示

### 1.6 セキュリティ / 設定

- [ ] 秘密情報（DB パスワード・APIキー）を**コードに直書きしない**（`Rails.application.credentials` または環境変数）
- [ ] **CORS**：開発は Vite プロキシで同一オリジンのため未構成でよい。もし有効化するなら**許可オリジンを限定**（ワイルドカード `*` 禁止。本番で別オリジンにする場合は本番ドメインのみ）
- [ ] `config/database.yml` の接続情報は環境変数化されている
- [ ] **SQL を文字列の組み立て（`"... #{値} ..."`）で作らない**。`where(id: ...)`・プレースホルダ・Arel（例：`Arel::Nodes::Case`）を使う（値を整数化していても Brakeman は安全を判定できない）
- [ ] **外部 API 呼び出しにはタイムアウトを付ける**（`Net::HTTP.start(..., open_timeout:, read_timeout:)`。既定 60 秒のままだと Puma のスレッドを塞ぐ）。失敗時の扱い（nil を返して手入力にフォールバック等）も決めておく

### 1.7 Lint / テスト

- [ ] **RuboCop** が通る（`bin/rubocop`。rubocop-rails-omakase。CI の Backend (lint + security) ジョブで実行）
- [ ] **Brakeman**（`bin/brakeman`）・**bundler-audit**（`bin/bundler-audit`）が警告なし
  - gem の更新は **patch / minor に限定**（`bundle update <gem> --minor --strict` / `--patch --strict`）。素の `bundle update` はメジャー更新まで進むことがある（例：json 2 → 3）。メジャー更新は別 PR で検討
  - `bin/brakeman` は `--ensure-latest` 付き（Rails 8 標準）。Brakeman 自体が古いだけでも失敗するので、そのときは brakeman を patch 更新する
  - 脆弱性の情報は日々更新される。CI で毎回実行し、見つかったら小さな PR で直す
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

- [ ] `v-for` の **`:key` は安定した一意 id**（配列インデックスではなく `book.id`）。並び替わらない固定の一覧（★の表示・エラーメッセージの列挙）は index でも可
- [ ] クリッカブル要素は `button` を使う（`div` の場合は `role` / `tabindex` / `@keydown`）
- [ ] フォーム要素に `label` が紐付いている

### 2.4 エラー / ローディング表現

- [ ] fetch のエラーが画面に表示される
- [ ] ローディング中の表示がある
- [ ] バリデーションエラー（Backend からの 422 + `errors`）がフォームに反映される

### 2.5 スタイル / 一貫性

- [ ] スタイルの当て方が無秩序に混在していない（scoped CSS / ユーティリティの方針が一貫）
- [ ] 命名（コンポーネント PascalCase / 関数・変数 camelCase / 型 PascalCase）が一貫
- [ ] 同じ値・同じ見た目を複数の部品に書いていない（定数は `src/lib/`（例：`PASSWORD_MIN_LENGTH`）、繰り返す見た目は共通部品へ）。モーダルの CSS の重複は既知の課題（#159）
- [ ] 1 部品が大きくなりすぎていない（目安 300 行。`KanbanBoard.vue`・`BookFormModal.vue` の分割は既知の課題（#159））

### 2.6 Lint / テスト / 型チェック / Build

- [ ] `npm test`（vitest）が成功。ロジック（`api/` `lib/`）やコンポーネントの振る舞いを変えたらテストを追加・更新（`src/**/__tests__/*.spec.ts`）
- [ ] `npm run build`（`vue-tsc` の型チェック含む）が成功
- [ ] `npm run lint`（ESLint：eslint-plugin-vue ＋ @vue/eslint-config-typescript ＋ @vitest/eslint-plugin。create-vue と同じ構成）が 0 件
- [ ] `npm run format:check`（Prettier：セミコロンなし・シングルクォート・100 文字）が通る。崩れていれば `npm run format`
- [ ] テンプレートのイベントで、引数を取る関数を `@click="fn"` と書いていない（イベントオブジェクトが第 1 引数に入る。`@click="fn()"` と書く。vue-tsc が検出する）

### 2.7 標準構成からのずれ（既知・Issue で管理）

- 画面の切り替えは `App.vue` の手作り（vue-router 未導入。#158）
- 状態管理ライブラリ（Pinia）は未使用（今の規模では不要。props と composable で足りている）

---

## 3. Docs（要件定義・機能要件・画面設計・データベース設計）

`docs/` 配下のドキュメントは**「実装を正」**とする。実装とずれていたら、コードではなくドキュメントを直す（書類にあって未実装のもの＝例：書影は `requirements.md` §4.2「将来拡張候補」へ移す）。実装変更時は同じ PR で更新する。

| ドキュメント | 実装の何と一致させるか |
|---|---|
| `docs/functional-requirements.md` | F 一覧・ユースケース・**API 表（§3）**・リクエスト / レスポンス例・エラー形式 ↔ `bin/rails routes -g api`・各 Controller の JSON |
| `docs/basic-design.md` | 画面遷移図・ER 図・データフロー・§4.3（操作と API / DB の対応） ↔ `App.vue`・`schema.rb`・Controller |
| `docs/screen-design.md` | 画面 S1〜S7 の表示項目・ボタン名・操作 ↔ `frontend/src/components/` |
| `docs/database-design.md` | テーブル・カラム・制約（NOT NULL / UNIQUE）・enum ↔ `backend/db/schema.rb`・モデル |
| `docs/requirements.md` | スコープ（§2）・非機能（§3）・将来候補（§4.2。実装済みのものが残っていないか） |
| `docs/tech-stack.md`・`README.md` | 使っている道具・コマンド・起動手順（seed・ログイン情報） |
| `docs/multi-user.md`・`docs/infrastructure.md` | 認証・招待・再設定の設計、`infra/` の構成・手順 |

- [ ] 上の表のとおり実装と一致している（特に API を足したら `functional-requirements.md` §3 と `basic-design.md` §4.3 の両方を更新）
- [ ] 「単一ユーザー」「将来」「予定」「想定」など、実装が進んで古くなりやすい言葉を検索し、**実装済みなのに古いまま**の記述が無いか見直す（将来候補・見積もり・規模の想定としての記述は正当なので残してよい）
- [ ] バリデーションルール（文字数・範囲・必須）がモデルの validation と一致
- [ ] README・docs の相対リンクが壊れていない

確認方法:
```bash
cd backend && bin/rails routes -g api            # API の一覧（docs の API 表と見比べる）
grep -rn "単一ユーザー\|将来\|予定\|想定\|書影" docs/ README.md   # 古くなりやすい言葉
python3 -c "import re,os;[print(f,t) for f in ['README.md']+['docs/'+x for x in os.listdir('docs') if x.endswith('.md')] for t in re.findall(r'\]\(([^)#\s]+)',open(f).read()) if not t.startswith('http') and not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(f),t)))]"   # リンク切れ（何も出なければ OK）
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
- [ ] コミットメッセージが Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:` / `refactor:` / `test:`）+ 日本語本文。**`style:` など他の type は使わない**（整形だけのコミットも `chore:`）
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
