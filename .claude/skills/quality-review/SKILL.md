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
> 作業の大きい改善（例：vue-router 導入・大きい部品の分割・I18n 化）は、その場で直さず GitHub Issue にして 1 つずつ進める（2026-09-26 の監査で登録済み：#158 vue-router・#159 部品分割と BaseModal・#160 I18n（以上 2026-09-27 対応済み）・#161 本番の config.hosts（2026-09-30 対応済み））。
>
> **同じ現象が続いたら「たまたま」で流さず、うまくいったときの記録と比べて原因を探す**（例：`Closes #…` で Issue が閉じないことが 3 回続いた → うまく閉じた PR と `closingIssuesReferences`・本文のバイト列・閉じた時刻を比べて、GitHub 全体の不具合と分かった。2026-09-30）。

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
- [ ] **`transaction do … end` の中で `return` しない**（Rails の版によって、途中で抜けたときに確定するか取り消すかの扱いが変わってきた）。断る条件の確認はトランザクションの前に済ませ、中では結果を変数に入れて、ブロックの外で返す（`MyTags#rename`。2026-10-04）

### 1.4 例外ハンドリング / エラーレスポンス

- [ ] `rescue_from` 等で例外を適切な HTTP ステータスに変換（広すぎる例外クラスは捕まえない）
  - `ActiveRecord::RecordNotFound` → **404**
  - バリデーション失敗 → **422**
  - 不正 JSON / パラメータ不足（`ActionController::ParameterMissing`）→ **400**（Rails が自動で返す）
  - **`params.require(:x)` は値が空の文字（`""`）でも 400 になる**。空を「入力してください」と日本語で断りたい（422）ときは `params[:x]` で受け取り、サービス・モデルで検査する（`TagsController#rename` の `to`。2026-10-04）
- [ ] エラーレスポンスは**このプロジェクトの統一形 `{ "errors": ["メッセージ", ...] }`**（文字列の配列。フロントの `ApiError` がこの形を前提にしている）
- [ ] ユーザーに見えるメッセージは日本語に揃え、`config/locales/ja.yml` に置く（コントローラに日本語を直書きせず `I18n.t("api.errors.…")`。新しいモデル・属性を足したら `activerecord.attributes` にも追加）
- [ ] レスポンス形を変える時はフロント（`frontend/src/api/books.ts`）への影響を確認

### 1.5 REST API 設計

- [ ] `resources` ルーティングを基本とし、HTTP メソッドの意味が正しい（GET/POST/PATCH/PUT/DELETE）
- [ ] ステータスコードが適切（**201** Created / **204** No Content / 400 / 404 / 422）
- [ ] URI は名詞・複数形（`/api/books`。操作的なものは `/api/books/reorder` のように許容）
- [ ] `render json:` に適切な `status:` を明示
- [ ] **CSV を作るときは、空の値を `nil` にそろえる**（Ruby の CSV は `nil` は何も書かず、空の文字 `""` は `""` と書くので、空欄の形がそろわない。`[].join` は `""` になる → `.presence`）。画面確認で見つけた（`BookCsvExporter`。2026-10-04、PR #264）

### 1.6 セキュリティ / 設定

- [ ] 秘密情報（DB パスワード・APIキー）を**コードに直書きしない**（`Rails.application.credentials` または環境変数）
- [ ] **CORS**：開発は Vite プロキシで同一オリジンのため未構成でよい。もし有効化するなら**許可オリジンを限定**（ワイルドカード `*` 禁止。本番で別オリジンにする場合は本番ドメインのみ）
- [ ] `config/database.yml` の接続情報は環境変数化されている
- [ ] 本番の **`config.hosts`** を空にしない（空だと確認されず全部許可）。許可する名前は `APP_HOSTS`（本番に届く Host は EC2 のパブリック DNS 名。`docs/infrastructure.md` §1.1）
- [ ] **SQL を文字列の組み立て（`"... #{値} ..."`）で作らない**。`where(id: ...)`・プレースホルダ・Arel（例：`Arel::Nodes::Case`）を使う（値を整数化していても Brakeman は安全を判定できない）
  - **既存の SQL 片を埋め込むのも同じ**：`where("#{self.class.first_occurred_on_sql('read')} BETWEEN ? AND ?", …)` は定数でも Brakeman が SQL Injection（Weak）を出す。集計・絞り込みは `BookStatusEvent.read.group(:book_id).having("MIN(occurred_on) BETWEEN ? AND ?", from, to).select(:book_id)` のような **id のサブクエリ**＋`where(id: …)` で書く（`Api::BooksController#count_finished_between`。2026-10-01、PR #236）
  - Brakeman の結果は `Security Warnings: 0` まで見る（`| tail -2` などで切ると警告の行だけになり見落とす）
- [ ] **外部 API 呼び出しにはタイムアウトを付ける**（`Net::HTTP.start(..., open_timeout:, read_timeout:)`。既定 60 秒のままだと Puma のスレッドを塞ぐ）。失敗時の扱い（nil を返して手入力にフォールバック等）も決めておく
- [ ] **外部サービスは、記事の紹介だけで選ばず、実際に問い合わせて確かめてから選ぶ**（終わったサービスや、中身が空のサービスがある。例：国立国会図書館の書影 API は 2026-03-31 に終了、openBD は表紙がほぼ無い。同じ ISBN 5 冊などで取れる割合を見て決める。2026-09-30）

### 1.7 Lint / テスト

- [ ] **RuboCop** が通る（`bin/rubocop`。rubocop-rails-omakase。CI の Backend (lint + security) ジョブで実行）
- [ ] **Brakeman**（`bin/brakeman`）・**bundler-audit**（`bin/bundler-audit`）が警告なし
  - gem の更新は **patch / minor に限定**（`bundle update <gem> --minor --strict` / `--patch --strict`）。素の `bundle update` はメジャー更新まで進むことがある（例：json 2 → 3）。メジャー更新は別 PR で検討
  - `bin/brakeman` は `--ensure-latest` 付き（Rails 8 標準）。Brakeman 自体が古いだけでも失敗するので、そのときは brakeman を patch 更新する
    - **見分け方**：ログが `Brakeman 8.0.6 is not the latest version 8.1.0` の 1 行だけで exit 5。**コードを変えていなくても、新しい版が出た日から落ちる**（2026-10-01、PR #230 で発生）
    - **中身の確認**：版の確認を外して実行し、警告なしなら原因は版だけ：`cd backend && bundle exec brakeman --no-pager -q --exit-on-warn --exit-on-error`
    - **直し方**：`bundle update brakeman --conservative`（ほかの gem は変えない。`Gemfile.lock` の 1 行だけ）を**別の Issue・PR で先にマージ**し、作業中のブランチに `git merge main` で取り込んで CI をやり直す（作業の PR に関係ない変更を混ぜない。#232）
  - 脆弱性の情報は日々更新される。CI で毎回実行し、見つかったら小さな PR で直す
- [ ] テストが通る（`bin/rails test` または RSpec）
- [ ] Rails の宛先名の確認（`ActionDispatch::HostAuthorization`・`config.hosts`）をテストするときは、偽のリクエストに **`HTTP_HOST` を付ける**（`Rack::MockRequest.env_for(url, "HTTP_HOST" => …)`。付けないと、許可した名前でも 403 になる。本物のリクエストには必ず付いている。#161）
- [ ] `define_singleton_method` で `Net::HTTP.start` などを差し替えるとき、**差し替えた処理の中の self は差し替え先（`Net::HTTP`）になり、テストの補助メソッドを呼べない**（NoMethodError になり、失敗が nil に隠れる）。応答は**先に作ってローカル変数で渡す**（`backend/test/services/google_books_client_test.rb`。2026-09-30）
- [ ] テストに**補助メソッド（`def create_… `など）を足す前に、同じファイルに同じ名前が無いか grep する**。Ruby は後から書いた定義で前のものを上書きするので、引数の違う既存テストが `ArgumentError: unknown keywords` で落ちる（`books_controller_test.rb` の `create_read_book`。2026-10-01、PR #236）
- [ ] ユーザーが入力する文字を保存・比較・検索・重複チェックする変更では [text-input-check](../text-input-check/SKILL.md) を確かめる（DB の照合順序は半角・全角・大文字小文字・かなを同じとみなす。2026-10-04、#271）
- [ ] **「◯◯は入らない・変わらない」を確かめる（否定の）テストでは、その◯◯を必ず用意する**。他人の本を作らずに「他人の本は入らない」と書くと、何も確かめていないのに通る（`export` のテスト。2026-10-04、PR #264 で作ってから確かめ直した）
- [ ] **一覧・絞り込みのテストの期待値は、fixture（`test/fixtures/*.yml` の初期データ）の本も数に入れる**。作った本だけで `assert_equal [ five.id, four.id ]` と書いたら、fixture の ★4 の本（`readable_code`）も当たって落ちた。`assert_includes` / `assert_not_includes` で「入る本・入らない本」を確かめ、fixture の本もどちらかに入れる（`books_controller_test.rb` の rating。2026-10-05、PR #284）
- [ ] **不具合を直したら、足したテストを直す前のコードで流し、落ちることを確かめる**（落ちないテストは不具合を見つけられない）：`git stash push <直したファイル>` → `bin/rails test <テスト>` → `git stash pop`（2026-10-05、PR #282 で 3 件落ちることを確認）
- [ ] マイグレーションは可逆（`change` で書けない場合は `up`/`down`）
- [ ] **データを直すマイグレーション**は、`db:migrate` の前に**確認用データ（直す対象・直さない対象・重なる場合）を作ってから**試す。流した後でも `bin/rails runner 'require Rails.root.join("db/migrate/<ファイル>").to_s; ActiveRecord::Migration.suppress_messages { <クラス>.new.up }'` で何度でも試せる。確認用データは最後に消す（2026-10-02、PR #246 で先に流してしまい、runner で試し直した）

---

## 2. Frontend（Vue 3 + TypeScript）

### 2.1 型の健全性

- [ ] `any` を使っていない（やむを得ない箇所は `unknown` + 型ガード）
- [ ] コンポーネントの **props / emits に型**が定義されている（`defineProps<...>()` / `defineEmits<...>()`）
- [ ] API レスポンスは `types/` の型に寄せる
- [ ] **型に項目を足したら、その型の値を書いているテストも grep して足す**（例：`grep -rn "finished_by_month: \[" frontend/src`）。vitest は型を見ないので通っても、`npm run build`（vue-tsc）で「missing the following properties」で落ちる（2026-10-03、`BookStats`）

### 2.2 リアクティビティ / Composition API

- [ ] **`<script setup>` + Composition API** を基本にしている
- [ ] `ref` / `reactive` / `computed` を適切に使い分け（派生値は `computed`）
- [ ] CRUD 等の再利用ロジックは **composable（`useBooks` 等）**に抽出する候補
- [ ] 楽観的更新を入れた箇所は、API 失敗時のロールバック（更新前の値を退避）が実装されている

### 2.3 描画 / a11y

- [ ] `v-for` の **`:key` は安定した一意 id**（配列インデックスではなく `book.id`）。並び替わらない固定の一覧（★の表示・エラーメッセージの列挙）は index でも可
- [ ] クリッカブル要素は `button` を使う（`div` の場合は `role` / `tabindex` / `@keydown`）
- [ ] フォーム要素に `label` が紐付いている
- [ ] 説明（ツールチップ）を**すぐ出したい**ときは `title` 属性ではなく自前の吹き出しにする。`title` は出るまでの待ち時間をブラウザが決め（Chrome で約 1 秒）、アプリからは変えられない。自前の吹き出しは CSS の `:hover` / `:focus-visible` ＋ `transition-delay: 0.2s`（0 だと通り過ぎただけでちらつく）、`role="tooltip"` を `aria-describedby` で結ぶ。隣の部品に重ならない側に出す（`KanbanColumn.vue` の読了見出し。2026-10-03、PR #260）

### 2.4 エラー / ローディング表現

- [ ] fetch のエラーが画面に表示される
- [ ] ローディング中の表示がある
- [ ] バリデーションエラー（Backend からの 422 + `errors`）がフォームに反映される

### 2.5 スタイル / 一貫性

- [ ] スタイルの当て方が無秩序に混在していない（scoped CSS / ユーティリティの方針が一貫）
- [ ] 命名（コンポーネント PascalCase / 関数・変数 camelCase / 型 PascalCase）が一貫
- [ ] 同じ値・同じ見た目を複数の部品に書いていない（定数は `src/lib/`（例：`PASSWORD_MIN_LENGTH`）、繰り返す見た目は共通部品へ）。モーダルの CSS の重複は既知の課題（#159）
- [ ] 見出しと行など、**文字の大きさが違う要素どうしで列をそろえる**ときは、列の幅を `em`（その要素の文字の大きさが基準）ではなく `rem` や `px` の**共通の値**（CSS 変数など）にし、両方で同じものを使う。`em` だと文字の小さい見出しの列が狭くなり、見出しが値からずれる（例：`ReadList.vue` の `--read-columns`。PR #211 で発生）。この種のずれは jsdom のテストでは見つからないので、画面で確認する（ui-check-steps）
- [ ] **一覧の高さを低く切らない**（`max-height` で中だけスクロールさせる場合）。Mac はスクロールバーがふだん隠れていて、続きがあると気づけない。画面の高さに合わせて伸ばし（`60vh` など）、切れるときは次の行が半分見えるようにする（タグの管理で 320px にして「確認用A が無い」と言われた。2026-10-04、PR #270）
- [ ] 1 部品が大きくなりすぎていない（目安 300 行。`KanbanBoard.vue`・`BookFormModal.vue` の分割は既知の課題（#159））

### 2.6 Lint / テスト / 型チェック / Build

- [ ] `npm test`（vitest）が成功。ロジック（`api/` `lib/`）やコンポーネントの振る舞いを変えたらテストを追加・更新（`src/**/__tests__/*.spec.ts`）
- [ ] `npm run build`（`vue-tsc` の型チェック含む）が成功
- [ ] `npm run lint`（ESLint：eslint-plugin-vue ＋ @vue/eslint-config-typescript ＋ @vitest/eslint-plugin。create-vue と同じ構成）が 0 件
- [ ] `npm run format:check`（Prettier：セミコロンなし・シングルクォート・100 文字）が通る。崩れていれば `npm run format`
- [ ] テンプレートのイベントで、引数を取る関数を `@click="fn"` と書いていない（イベントオブジェクトが第 1 引数に入る。`@click="fn()"` と書く。vue-tsc が検出する）

### 2.7 標準構成からのずれ（既知・Issue で管理）

- 画面の切り替えは vue-router（#158 で導入済み）。新しい画面は `src/router/index.ts` の routes に足し、ログインが要るかは `meta.requiresAuth` / `meta.guestOnly` で決める
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
- [ ] **画面の言葉・API パラメータ・部品の名前を変えたら、古い言葉で docs 全体を grep する**（例：`grep -rn "著者" docs/`）。表や図の 1 か所だけ直して、別の章（S8 の説明・基本設計の画面表）に古い言葉が残りやすい（PR #230 で「著者 → キーワード」が 2 か所残り、#236 で直した。2026-10-01）
- [ ] **境目のある動き**（例：何冊から右の段へ移るか）を docs やコメントに書くときは、式に**境目の値**（25・26・50・51 など）を入れて確かめてから書く。「30 冊を超えたら半分ずつ」のように丸めると、31〜60 冊の実際の動き（左 30・右に残り）とずれる（2026-10-03、PR #250）
- [ ] docs に**日付**（「2026-10-03 に対応済み」など）を書くときは、思い込まずに `date +%F` で今日を確かめる（2026-10-03、10-04 と書きかけた）
- [ ] **docs に数字（大きさ・件数・時間など）を書くときは、見込みで書かず実際に測った値を書き、測った日と条件を添える**（例：「2026-10-04 の開発 DB 9 冊の CSV は 1,263 バイト」。見込みの「1 冊 100〜200 バイト」から直した。PR #268）
- [ ] **機能を足した PR では、詳細の docs（機能要件・画面設計・基本設計）だけでなく、概要も直す**：要件定義書（関連ドキュメントの表の F 番号の範囲・§1.3 解決する課題・§2.1 対象・§5 追加した機能）、README の主要機能、`docs/multi-user.md` の実装済みの表（ユーザーや管理者に関わるとき）。取り残しやすく、2026-10-04 は #268・#276 でまとめて直した
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
- [ ] 安全のための設定（`config.hosts`・セキュリティグループなど）を変えたら、**通るべきものが通ること**と、**断るべきものが断られること**の両方を本番（AWS）で確かめる。確認の対象外にしたページ（`/up`）が 200 でも効き目は分からないので、本体のページ（例：`/api/session` が 401＝通過）と、わざと違う条件（例：EC2 内から `curl -H "Host: evil.example.com"` → 403）で見る（#161）

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
- [ ] **マージ前に GitHub が `Closes` を認識しているか確かめる**（`gh pr view <PR番号> --json closingIssuesReferences -q '[.closingIssuesReferences[].number]'` が `[]` なら、マージ後に手動で閉じる前提）。マージ後は Issue が閉じたかも確かめ、`OPEN` のままなら手動で閉じる（CLAUDE.md §6。2026-09-30 から GitHub 全体の不具合で Closes のつながりが作られず、PR #222・#224・#226 で自動で閉じなかった）
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

### コマンドを書くときの注意（このプロジェクトのシェルは zsh）

- **`path` という名前の変数を使わない**。zsh では `path` がコマンドを探す場所（`PATH`）と結び付いているので、`while read verb path` などと書くと、その中で `sed` などが「command not found」になる（2026-10-04）。`route` などほかの名前にする
- `grep --include=*.vue` のような `*` は**引用符で囲む**（`--include='*.vue'`）。囲まないと zsh が先に展開しようとして「no matches found」で止まる（2026-10-05 にも同じ失敗をした。grep を書いたら `*` の周りを見直す）
- 探す文字に `` ` ``（バッククォート）を入れるときは、模様を**一重引用符**で囲む。二重引用符の中の `` `q` `` はコマンドとして実行され、「command not found: q」になって模様が壊れる（2026-10-05）
- 削除（`rm`）を含むコマンドは許可されないことがある。ほかの処理とつなげず、分けて実行する。プロジェクトの外（`~/Downloads` など）のファイルを消すときは、ユーザーにお願いする

## 関連

- プロジェクト規約: [CLAUDE.md](../../../CLAUDE.md)
- ポート規約: [enforce-default-ports](../enforce-default-ports/SKILL.md)
- 文字入力（保存・比較・検索・重複チェック）の確認: [text-input-check](../text-input-check/SKILL.md)
- 日報と再発防止の確認（詰まったことをここに書き足す手順）: [daily-report](../daily-report/SKILL.md)
