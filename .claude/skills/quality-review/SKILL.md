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
- [ ] **たくさんの行をまとめて書き込む処理（CSV 読み込みなど）は、1 件ずつ `create!` しない**。1 件ごとにコールバック・タグの find_or_create・関連の INSERT が走り、問い合わせが件数の何倍にもなる（CSV 1,000 冊で約 7,800 回・23 秒 → `insert_all` でまとめて 0.34 秒。2026-11-01、PR #308）。`insert_all` はコールバックを通らないので、`after_create` でしていたこと（状態の履歴など）は自分で作る。MySQL は書き込んだ行の id を返さないので、書き込む前の `maximum(:id)` より後を、重ならないキー（タイトル＋著者など）で引き当てる
  - テストで守る：`ActiveSupport::Notifications.subscribed(counter, "sql.active_record") { … }` で問い合わせの回数を数え、「60 件で 25 回未満」のように**件数に比例しない**ことを確かめる（直す前のコードで落ちることも確かめる）
  - 本番は **CloudFront が返事を 30 秒まで**しか待たず、POST は超えるとやり直さずに 504 を返す（画面はエラーなのに、サーバーでは処理が進んで書き込まれる）。手元で 10 秒を超える処理は、本番では危ない（本番はサーバーが小さく、DB が別の機械）
- [ ] **データの量が増えたときの速さ**（要件 3.1：1,000 冊）は、確認用アカウントに件数を入れて実測する：`bin/rails runner` で 1,000 件（状態・タグ・日付をばらす。transaction で包む）→ API は curl で各 5 回の中央値（`-w '%{time_total}'`）、画面は playwright-core で「本が出るまで」を測る（`networkidle` は 0.5 秒の静けさを待つ分だけ長く出る）。重い操作（CSV 読み込み・書き出し）も忘れずに測る。終わったらアカウントと確認用タグを消す（2026-11-01）
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

- [ ] **開発用のサーバー・DB は Mac の中だけで待ち受ける**：docker の `ports` は `"127.0.0.1:<port>:<port>"` と書く（`"3306:3306"` はすべての入り口）、Vite の `server.host: true` や `rails server -b 0.0.0.0` を使わない。家以外の Wi-Fi でほかの機械からつながる（2026-10-29、#303。確かめ方は [enforce-default-ports](../enforce-default-ports/SKILL.md)）
- [ ] 秘密情報（DB パスワード・APIキー）を**コードに直書きしない**（`Rails.application.credentials` または環境変数）
- [ ] **CORS**：開発は Vite プロキシで同一オリジンのため未構成でよい。もし有効化するなら**許可オリジンを限定**（ワイルドカード `*` 禁止。本番で別オリジンにする場合は本番ドメインのみ）
- [ ] `config/database.yml` の接続情報は環境変数化されている
- [ ] 本番の **`config.hosts`** を空にしない（空だと確認されず全部許可）。許可する名前は `APP_HOSTS`（本番に届く Host は EC2 のパブリック DNS 名。`docs/infrastructure.md` §1.1）
- [ ] **SQL を文字列の組み立て（`"... #{値} ..."`）で作らない**。`where(id: ...)`・プレースホルダ・Arel（例：`Arel::Nodes::Case`）を使う（値を整数化していても Brakeman は安全を判定できない）
  - **既存の SQL 片を埋め込むのも同じ**：`where("#{self.class.first_occurred_on_sql('read')} BETWEEN ? AND ?", …)` は定数でも Brakeman が SQL Injection（Weak）を出す。集計・絞り込みは `BookStatusEvent.read.group(:book_id).having("MIN(occurred_on) BETWEEN ? AND ?", from, to).select(:book_id)` のような **id のサブクエリ**＋`where(id: …)` で書く（`Api::BooksController#count_finished_between`。2026-10-01、PR #236）
  - Brakeman の結果は `Security Warnings: 0` まで見る（`| tail -2` などで切ると警告の行だけになり見落とす）
- [ ] **外部 API 呼び出しにはタイムアウトを付ける**（`Net::HTTP.start(..., open_timeout:, read_timeout:)`。既定 60 秒のままだと Puma のスレッドを塞ぐ）。失敗時の扱い（nil を返して手入力にフォールバック等）も決めておく
- [ ] **外部サービスは、記事の紹介だけで選ばず、実際に問い合わせて確かめてから選ぶ**（終わったサービスや、中身が空のサービスがある。例：国立国会図書館の書影 API は 2026-03-31 に終了、openBD は表紙がほぼ無い。同じ ISBN 5 冊などで取れる割合を見て決める。2026-09-30）
- [ ] **外部 API の回数の上限は、記事ではなく、使う人の管理画面で確かめる**。1 日の上限だけでなく **1 分の上限**も見て、続けて問い合わせる処理は間を空ける（Google Books は公式ページに数字が無く、記事は 1,000 / 10,000 とばらばら。管理画面では 1 日 1,000・1 分 100 で、まとめて取得が 1 分の上限に当たる作りだった。2026-10-15、PR #294 で間 0.6 秒と `rate_limited` を追加）
- [ ] **外部 API が「0 件」を返したら、まずこちらの問題か外部の不具合かを切り分ける**：同じ鍵で普通の検索（題名など）を試す・有名な本でも 0 件か見る・開発者の掲示板を「サービス名＋症状＋年」で検索する（Google Books は 2026-09 末から `isbn:` `intitle:` など指定付きの検索だけ 0 件。HTTP 200 で `totalItems: 0`）。問い合わせは回数の枠を使うので、1 回ずつ数を決めて試す
- [ ] **外部の不具合で止まったら、「直るまで待つ」を勧める前に、まだ動く使い方で回避できないか試す**。回避するときは結果を必ず確かめる（Google Books は題名＋著者で普通に検索し、ISBN が一致する本の表紙だけを使う。番号だけで検索すると別の本が返るので使わない）。「明日まで延期」と提案して「直っていない可能性が高いので再考して」と言われた（2026-10-15、PR #294）

- [ ] **外部 API の結果を取っておく（キャッシュ）ときは、「見つからない」と「失敗（つながらない・上限・鍵なし）」を分けて返す**。分けないと、つながらなかっただけの結果を「見つからない」として何日も使い続ける。OpenbdClient は見つからない・失敗をどちらも nil で返していたので、`lookup` で `:found` / `:not_found` / `:error` を返すようにしてから取っておいた（`IsbnLookup`。見つかった 30 日・見つからない 7 日・失敗は取っておかない。2026-11-03、PR #375）

### 1.7 Lint / テスト

- [ ] **RuboCop** が通る（`bin/rubocop`。rubocop-rails-omakase。CI の Backend (lint + security) ジョブで実行）
- [ ] **Brakeman**（`bin/brakeman`）・**bundler-audit**（`bin/bundler-audit`）が警告なし
  - gem の更新は **patch / minor に限定**（`bundle update <gem> --minor --strict` / `--patch --strict`）。素の `bundle update` はメジャー更新まで進むことがある（例：json 2 → 3）。メジャー更新は別 PR で検討
  - `bin/brakeman` は `--ensure-latest` 付き（Rails 8 標準）。Brakeman 自体が古いだけでも失敗するので、そのときは brakeman を patch 更新する
    - **見分け方**：ログが `Brakeman 8.0.6 is not the latest version 8.1.0` の 1 行だけで exit 5。**コードを変えていなくても、新しい版が出た日から落ちる**（2026-10-01、PR #230 で発生）
    - **中身の確認**：版の確認を外して実行し、警告なしなら原因は版だけ：`cd backend && bundle exec brakeman --no-pager -q --exit-on-warn --exit-on-error`
    - **直し方**：`bundle update brakeman --conservative`（ほかの gem は変えない。`Gemfile.lock` の 1 行だけ）を**別の Issue・PR で先にマージ**し、作業中のブランチに `git merge main` で取り込んで CI をやり直す（作業の PR に関係ない変更を混ぜない。#232）
  - 脆弱性の情報は日々更新される。CI で毎回実行し、見つかったら小さな PR で直す
    - **関係ない PR の CI が、新しく公開された脆弱性で落ちる**ことがある（2026-10-29、画面だけの PR #298 で bundler-audit が crass・net-ssh で失敗）。見分け方：`gh run view <run番号> --log-failed` に `Name:` `Version:` `Solution: update to …` が出る。直し方は Brakeman と同じ：その gem だけ `bundle update <gem> --conservative` を**別の Issue・PR**（#300）で先にマージ → 作業中のブランチに `git merge origin/main` → CI をやり直す。手元の Rails は起動し直すまで古い版のまま動く
    - **Rails 本体の弱点のときは**、Dependabot の PR もお知らせも来ないことがある（2026-11-05、Rails 8.1.4 の actionpack など 20 件以上・危険度「高い」を含む。GitHub のお知らせは 0 件のままだった）。Rails 本体は CLAUDE.md の決まりで**変更点を説明して相談**してから、`cd backend && bundle update rails --patch --conservative`（Rails の部品だけ。`Gemfile.lock` の Rails の行以外が変わっていないか `git diff` で見る）→ `bin/bundler-audit check --update` で 0 件。マージしたら手元で `bundle install` と Rails の起動し直し（動いている Rails は古い版のまま。PR #391）
    - **弱点のために部品を上げたら、直ったことだけでなく次も伝える**：残りの弱点（bundler-audit・`gh api repos/adamaru-code/reading-board/dependabot/alerts -q '[.[] | select(.state=="open")] | length'`）・ほかに変わった部品（`git diff Gemfile.lock`）・新しい版はあるが弱点ではない部品（`bundle outdated --only-explicit --strict`）。伝えなかったら「直し以外はどうなりましたか」と聞かれ、調べたら別のお知らせ（minimatch #21）が増えていた（2026-11-05）
- [ ] テストが通る（`bin/rails test` または RSpec）
- [ ] Rails の宛先名の確認（`ActionDispatch::HostAuthorization`・`config.hosts`）をテストするときは、偽のリクエストに **`HTTP_HOST` を付ける**（`Rack::MockRequest.env_for(url, "HTTP_HOST" => …)`。付けないと、許可した名前でも 403 になる。本物のリクエストには必ず付いている。#161）
- [ ] `define_singleton_method` で `Net::HTTP.start` などを差し替えるとき、**差し替えた処理の中の self は差し替え先（`Net::HTTP`）になり、テストの補助メソッドを呼べない**（NoMethodError になり、失敗が nil に隠れる）。応答は**先に作ってローカル変数で渡す**（`backend/test/services/google_books_client_test.rb`。2026-09-30）
- [ ] テストに**補助メソッド（`def create_… `など）を足す前に、同じファイルに同じ名前が無いか grep する**。Ruby は後から書いた定義で前のものを上書きするので、引数の違う既存テストが `ArgumentError: unknown keywords` で落ちる（`books_controller_test.rb` の `create_read_book`。2026-10-01、PR #236）
- [ ] **`travel 31.days { … }` と書かない**。`{ }` は直前の `31.days` に渡り、`travel` は時間を進めるだけで中の処理は動かない（テストは「呼ばれた回数 0」で落ちた）。`travel(31.days) { … }` とかっこを付けるか、`do … end` を使う（2026-11-03、PR #375）
- [ ] **controller などが呼ぶ外部 API の関数を変えたら、テストの差し替え（`define_singleton_method`）も新しい関数に変える**。古い関数を差し替えたままだと効かず、テストが本物の openBD・Google に問い合わせる（`OpenbdClient.fetch` → `lookup`、`GoogleBooksClient.cover_url` → `lookup`。`grep -rn "define_singleton_method(:<古い関数>" test` で探す。2026-11-03、PR #375）
- [ ] ユーザーが入力する文字を保存・比較・検索・重複チェックする変更では [text-input-check](../text-input-check/SKILL.md) を確かめる（DB の照合順序は半角・全角・大文字小文字・かなを同じとみなす。2026-10-04、#271）
- [ ] **「◯◯は入らない・変わらない」を確かめる（否定の）テストでは、その◯◯を必ず用意する**。他人の本を作らずに「他人の本は入らない」と書くと、何も確かめていないのに通る（`export` のテスト。2026-10-04、PR #264 で作ってから確かめ直した）
- [ ] **一覧・絞り込みのテストの期待値は、fixture（`test/fixtures/*.yml` の初期データ）の本も数に入れる**。作った本だけで `assert_equal [ five.id, four.id ]` と書いたら、fixture の ★4 の本（`readable_code`）も当たって落ちた。`assert_includes` / `assert_not_includes` で「入る本・入らない本」を確かめ、fixture の本もどちらかに入れる（`books_controller_test.rb` の rating。2026-10-05、PR #284）
- [ ] **不具合を直したら、足したテストを直す前のコードで流し、落ちることを確かめる**（落ちないテストは不具合を見つけられない）：`git stash push <直したファイル>` → `bin/rails test <テスト>` → `git stash pop`（2026-10-05、PR #282 で 3 件落ちることを確認）
- [ ] マイグレーションは可逆（`change` で書けない場合は `up`/`down`）
- [ ] `bin/rails runner` で確認用データを作るときは、**途中で止まっても半端に残らないように**、`ActiveRecord::Base.transaction do … end` で包むか、止まったらまず何ができたかを読み直す。`ENV.fetch("PWFILE")` を渡し忘れ、アカウントと本は作られたのにパスワードの保存だけ失敗した（2026-10-29）
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
- [ ] **モーダル・タブは共通の部品を使う**：モーダルは `BaseModal.vue`（Tab を枠の中に閉じ込める・Esc・閉じたら開いたボタンへ戻す・開いたら `[autofocus]` へ）、タブは `BaseTabs.vue`（← → / Home / End・選んだタブだけ `tabindex="0"`・`role="tabpanel"`）。自分で書くと、矢印キー・フォーカスの戻し先を忘れやすい（2026-11-03、#351・#355・#357）
- [ ] **`autofocus` だけに頼らない**：Chrome は、ほかの所（押したボタンなど）にフォーカスがあると `autofocus` を無視する。モーダルの中なら `BaseModal` が移すので `autofocus` を付ければよい（2026-11-03、PR #357）
- [ ] **お知らせの欄（`role="status"`・`aria-live`）は最初から置いておき、中の文だけを出し入れする**。`<p v-if="msg" role="status">` のように欄ごと作ると、VoiceOver が読まない（2026-11-03、ユーザーが VoiceOver で確認。PR #363）。中にボタン・入力欄があるもの、画面が入れ替わって出るものは、読み上げ用の短い文を `class="visually-hidden"`（`style.css`）の欄に別に置く。`role="alert"`（エラー）は出たときに読まれる
- [ ] **フォーカスを動かした直後のお知らせ**は、VoiceOver がフォーカス先（「〇〇 を編集」）を先に読み、控えめな `role="status"` を読まない。`aria-live="assertive"` の欄に、フォーカスを移した 0.2 秒あとに入れる（`KanbanBoard.vue` の `announce`。2026-11-03、PR #361）
- [ ] **`aria-label` は中身をすべて上書きする**。カードのように中に詳細があるものは、名前（「〇〇 を編集」）だけを `aria-label` にし、詳細は `aria-describedby` で結ぶ（`BookCard.vue`）。ふつうの `div`・`span` の `aria-label` は効かないので、★の評価のような図は `role="img"` を付ける（2026-11-03、PR #353）。テストでは `__tests__/describedText.ts` で説明の文を組み立てて確かめる
- [ ] **ラベルと薄い字（placeholder）に同じ言葉を入れない**。読み上げソフトは名前のあとに placeholder も読むので「タグ タグを入力して Enter」と重なる（2026-11-03、PR #353）
- [ ] **ドラッグでしかできない操作を作らない**（キーボードの代わりを用意する。カードは Option ＋ 矢印キー、`lib/keyboardMove.ts`。2026-11-03、PR #361）
- [ ] **色だけで違いを伝えない**：★の塗りと空は形でも分ける（★ / ☆）。図・枠線は白との差 3 以上、文字は 4.5 以上。計算は `node -e` で相対輝度から出す（2026-11-03、PR #359 で空の ☆ と入力欄の枠線を `#8590a2`＝3.23 に）

### 2.4 エラー / ローディング表現

- [ ] fetch のエラーが画面に表示される
- [ ] ローディング中の表示がある
- [ ] バリデーションエラー（Backend からの 422 + `errors`）がフォームに反映される

### 2.5 スタイル / 一貫性

- [ ] スタイルの当て方が無秩序に混在していない（scoped CSS / ユーティリティの方針が一貫）
- [ ] 命名（コンポーネント PascalCase / 関数・変数 camelCase / 型 PascalCase）が一貫
- [ ] 同じ値・同じ見た目を複数の部品に書いていない（定数は `src/lib/`（例：`PASSWORD_MIN_LENGTH`）、繰り返す見た目は共通部品へ）。モーダルのボタン・エラー表示（`.btn`・`.btn-primary`・`.btn-ghost`・`.btn-danger`・`.btn-small`・`.modal-actions`・`.spacer`・`.form-errors`）は `style.css` にある。部品に同じ CSS を書き足さない（2026-11-05、PR #393）
- [ ] **CSS を全体（`style.css`）にまとめるときは、値の違う部品にも効く**ことに気をつける。部品の scoped CSS が書いていない値（例：確認ダイアログの `.btn-ghost` は背景だけ → 全体の灰色の枠線が付く）が新しく効くので、部品の側で打ち消す（`border-color: transparent` など）。確かめ方：まとめる**前と後**に本物の Chrome ですべての画面を開き、ボタンなどの `getComputedStyle` の値（色・枠線・角丸・余白など）を記録して比べ、違い 0 にする（PR #393 は 15 場面・169 要素・22 項目。scratchpad に記録のスクリプトを作った）
- [ ] 見出しと行など、**文字の大きさが違う要素どうしで列をそろえる**ときは、列の幅を `em`（その要素の文字の大きさが基準）ではなく `rem` や `px` の**共通の値**（CSS 変数など）にし、両方で同じものを使う。`em` だと文字の小さい見出しの列が狭くなり、見出しが値からずれる（例：`ReadList.vue` の `--read-columns`。PR #211 で発生）。この種のずれは jsdom のテストでは見つからないので、画面で確認する（ui-check-steps）
- [ ] **一覧の高さを低く切らない**（`max-height` で中だけスクロールさせる場合）。Mac はスクロールバーがふだん隠れていて、続きがあると気づけない。画面の高さに合わせて伸ばし（`60vh` など）、切れるときは次の行が半分見えるようにする（タグの管理で 320px にして「確認用A が無い」と言われた。2026-10-04、PR #270）
- [ ] **スマホの幅（375px・390px）とタブレット（768px）でも撮って確かめる**（要件 3.5）。横スクロールが 0 でも、ヘッダが画面の半分を占める・文字が途中で折れる・ボタンがはみ出す、は数では分からない（2026-10-29 に初めて確かめて 5 つ見つかった。撮り方は [ui-check-steps](../ui-check-steps/SKILL.md) §4）
- [ ] **グリッドの列の幅を直したら、空の値・長い値の行も撮り直す**。読了一覧のスマホの 2 行目で著者に最低幅を付けたら、著者の無い行でジャンルがつぶれて「雑誌」と重なった → 入りきらないものは折り返す（`display: flex; flex-wrap: wrap`）、中身の無い所は `:empty { display: none }` で詰める（2026-10-29、PR #298）
- [ ] **並びを組み替えたら（スマホ用に部品を分けるなど）、パソコンの見た目が変わっていないかを数で比べる**：直す前（`git stash push frontend`。読み込み直しに数秒待つ）と後で、部品の左端・上端を `getBoundingClientRect()` で出して比べる。画像のファイルの比較（`cmp`）は撮るたびに違うので使わない。`display: contents` で箱を外したら、間隔（`gap`）が変わりやすい（PR #298 で 16px → 24px になり、`order` と `margin-left: -8px` で戻した）
- [ ] **日本語の折り返しは `word-break: auto-phrase`（`style.css` の body。Chrome 119+）で言葉のまとまりごとにしているが、Chrome の区切り（機械学習）は間違えることがある**（幅 420px で「間／違った」「1／行」と折れた）。説明文を足したら、使う幅（420・375px など）で撮って確かめ、変なところで折れたら CSS ではなく**言い回しを変える**（「誤りのある行」。2026-11-02、PR #314）
- [ ] 1 部品が大きくなりすぎていない（目安 300 行）。大きくなったら、役割ごとに composable（`src/composables/`）へ分ける。分けたあとは E2E で「壊していない」を確かめる（`KanbanBoard.vue` を 534 → 377 行に。useBoardFilters・useBookStats・useCardMove。2026-11-03、PR #371）
  - **300 行は目安で、決まりではない**。部品を分ける・まとめるなどの整理（使う人から見た変化が無い作業）は、始める前に**何のためか（読みやすさ・壊しにくさ・同じものを何度も書かない）と、かかる時間・効き目の大きさ**を説明してから進める。説明しないまま「次は分ける」と進め、「やる理由はなんですか」と聞かれた。説明したら、効き目の小さいボード・読了一覧は分けないことになった（2026-11-05）
- [ ] **同じクラスの要素を足したら、今ある CSS の選び方が新しい要素にも効かないかを見る**。月ごとのグラフに前の年の棒（`.bar.previous`）を足したら、今月を濃い緑にする `.month.current .bar` が前の年の棒にも効いた → `.bar.now` に限る。jsdom のテストでは色は分からないので、本物の画面で撮るか `getComputedStyle(…).backgroundColor` を出して確かめる（2026-11-03、PR #379）
- [ ] **グラフに棒・線を足したら、本物の画面で撮って「数字がどれのものか」見分けられるかを見る**。2 本並べた棒の上の数字（選んだ年）が、背の高い灰色の棒（前の年）の数字に見えた → 数字を緑の棒の真上へ `translateX` でずらした（2026-11-03、PR #379）

### 2.6 Lint / テスト / 型チェック / Build

- [ ] `npm test`（vitest）が成功。ロジック（`api/` `lib/`）やコンポーネントの振る舞いを変えたらテストを追加・更新（`src/**/__tests__/*.spec.ts`）
- [ ] `npm run build`（`vue-tsc` の型チェック含む）が成功
- [ ] `npm run lint`（ESLint：eslint-plugin-vue ＋ @vue/eslint-config-typescript ＋ @vitest/eslint-plugin。create-vue と同じ構成）が 0 件
- [ ] `npm run format:check`（Prettier：セミコロンなし・シングルクォート・100 文字）が通る。崩れていれば `npm run format`
- [ ] **画面全体（`window`）にリスナーを付ける部品（`BaseModal` など）をテストで `mount` したら、必ず `unmount` する**。閉じ忘れると、次のテストのキー操作をそのリスナーが横取りして落ちる（2026-11-03、PR #351）
- [ ] **テンプレートの先頭にコメントがある部品**（`BookCard.vue` など）は、テストの `wrapper.element` が外側の入れ物になる。`wrapper.find('.card').element` のように中の要素を取る（2026-11-03、PR #353）
- [ ] 画面に見せない文字（`visually-hidden`）も `.text()` に入る。読み上げ用の言葉を足したら、文字を比べているテストの期待値も直す（2026-11-03、PR #353）
- [ ] **E2E テスト（Playwright、`frontend/e2e/`）**：本物の Chrome で、本物のアプリ（Vite 5173 → Rails 3000 → MySQL）を操作して確かめる。手元はサーバーを起動して `cd frontend && npm run test:e2e`、CI はジョブ「E2E (Playwright)」で PR ごとに流れる（2026-11-03、#367・#369）
  - **画面の流れ（ログイン・本の追加 / 編集 / 削除・カードの移動・絞り込み・読了一覧・統計・CSV・パスワード変更・タグの管理・招待と登録・パスワード再設定）を変えたら、E2E を流す**。新しい画面・流れを作ったら E2E にも足す（下準備の本は `support.ts` の `createBook` で API から作る）
  - E2E 専用のアカウント `e2e@example.com`（管理者）は global-setup で作り直し、global-teardown で、登録で作る `e2e-new@example.com` とともに本ごと消す。パスワード変更のテストは、使い回しているログインのまま変えて API で元に戻す（変更はほかの端末のログインだけを消すので、ほかのテストに影響しない。#394）。ログインは auth.setup で 1 回だけ（ログイン状態を使い回す）。**1 回流すとログインを 3 回使うので、続けて流すのは 3 分に 3 回まで**（当たったら「ログインの回数制限に当たりました」で止まる。3 分待つか Rails を起動し直す。CI は毎回新しい Rails なので当たらない）。招待からの新規登録は 1 時間に 10 回までなので、続けて流すのは 1 時間に 10 回まで
  - **CI の E2E が落ちたら**、PR の Checks →「Summary」の Artifacts にある `e2e-results`（画面の写真・操作の記録 trace・rails.log・vite.log）を落として見る。手元の失敗は `frontend/test-results/`（`npx playwright show-trace <trace.zip>`）
  - **指し方は、開いている画面（`page.getByRole('dialog')`）の中に絞り、ボタンは `exact: true`**。ページ全体で `getByLabel('タイトル')` と探すとボードの上のキーワード欄（「タイトル・著者・メモで絞り込み」）にも、`getByRole('button', { name: '追加' })` はタグ候補のボタン（「〇〇をタグに追加」）にも当たる（strict mode violation。2026-11-03、PR #367）
  - **ボタンを押したあとは、処理が終わった印（お知らせの文など）を待ってから確かめる**。押した直後は処理中の表示で、たとえばタグの名前を変える欄の「『b』と 1 つにまとめます」にも b が入っていて、「b の行」が 2 つに当たってすぐ落ちた。また 1 つの画面に `role="status"` の欄が複数あることがある（アカウントの画面はパスワード用とタグ用）ので、`.done-message` など中身で絞る（2026-11-05、PR #395）
  - **画面が保存を待たずに先に動く操作（カードの移動など、楽観的更新）のあとに `page.reload()` するときは、保存が終わった印を待つ**（キーボードの移動は読み上げのお知らせ、ドラッグは `page.waitForResponse` で `PATCH /api/books/reorder` の返事）。待たないと、手元では通るのに CI の機械が遅いときだけ、保存の前に読み込み直して元の並びが出て落ちる（関係ない Dependabot の PR #400 で発生。2026-11-13、PR #403）
  - **こちらで流すときは `| tail` でまとめず、ファイルに書き出す**（`npx playwright test --reporter=list > <scratchpad>/e2e.log 2>&1`）。`| tail` は終わるまで何も出ないので、止まっているのか動いているのか分からない（最初の 1 回は 5 分出ず止めた）。Mac には `timeout` コマンドが無い（exit 127）。長く待つときは Bash の `run_in_background` や Monitor を使う（2026-11-03）
  - E2E の型チェックは `tsconfig.e2e.json`（`moduleResolution: "bundler"`。`nodenext` だと `import './support'` に拡張子を求められる）。vitest は `src/**/__tests__/*.spec.ts` だけを読むので、`e2e/*.spec.ts` と混ざらない
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
- [ ] **画面・タブを足した・画面の幅や部品を変えた PR では、2 つの表も直す**：画面設計 §1「画面一覧」（目的の列）と、基本設計 §5「画面の構成要素と対応 API」（構成要素・使う API）。本文の章だけ直して表が取り残されやすい（2026-11-03 の突き合わせ #385 で、S9 統計の行が 10/3 から §5 に無く、S7 の CSV・タグ・表紙のタブが 10/4 から両方に無く、モーダルの幅も #311 の前のままだった）。ときどき `bin/rails routes -g api`・`schema.rb`・`frontend/src/components/` と docs を突き合わせる（この章の確認方法）
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
- [ ] **CI が `fail` でも、まず中身を見る**。ジョブが実行する機械を待ったまま（queued）取り消されると、テストを 1 つも流さずに `fail` と出る（2026-10-05、文章だけの PR #286 で Backend (Rails test) が 15 分 queued → cancelled）
  - 見分け方：`gh run view <run番号> --json jobs -q '.jobs[] | {name, conclusion, steps: (.steps | length)}'` で `conclusion` が `cancelled`・`steps` が `0`
  - 直し方：コードは変えず `gh run rerun <run番号> --failed` でやり直す。`failure`（テストが落ちた）なら `gh run view <run番号> --log-failed` で原因を見る
- [ ] **CI が 5 分以上 queued のままなら、GitHub の状況を確かめてユーザーに伝える**（待つだけにしない。2026-10-05、障害を伝えないまま待ち続け、ユーザーに「時間かかりすぎではないですか？」と聞かれた）
  ```bash
  curl -s https://www.githubstatus.com/api/v2/components.json | python3 -c "import json,sys; [print(c['name'], c['status']) for c in json.load(sys.stdin)['components'] if 'Actions' in c['name']]"
  ```
  `operational` 以外（`degraded_performance`・`major_outage` など）なら、GitHub 側の障害で順番待ちになっていると伝える。古い run が順番を取っていたら `gh run cancel <run番号>` で外す
- [ ] **やり直しても障害で取り消され続けるときは、同じ確認を手元で流し、マージしてよいかユーザーに聞く**（`.github/workflows/ci.yml` と同じコマンド。勝手にマージしない。2026-10-06、PR #286 の Terraform）
  - Terraform：`cd infra && terraform fmt -check -recursive && terraform validate`（版は ci.yml と同じか `terraform version` で確かめる。手元の `infra/.terraform` は AWS 用に初期化済みなので **`terraform init` はしない**）
  - 了承を得たら、取り消された理由と手元の結果を PR にコメントで残してからマージする（`gh pr comment <PR番号> --body "…"`）
- [ ] **PR 本文に書くテストの件数などの数字は、その PR のブランチで流した結果を書く**（main や別のブランチで流した数を書かない。2026-11-01、PR #307 に別のブランチの「199 runs」を書き、実際は 198 だった）
- [ ] PR テンプレ（`.github/pull_request_template.md`）に沿っている
- [ ] フォーマッタによる一括変更は **別コミット** に分けている
- [ ] 1 PR = 1 トピック。複数トピックを混ぜていない
- [ ] マージは squash + branch 削除（`gh pr merge --squash --delete-branch`）
- [ ] **ブランチ名の Issue 番号は、`gh issue create` が出した URL の末尾の数字を使う**（予想で書かない。Dependabot の PR も同じ番号の列を使うので、番号は飛ぶ）。間違えたら、push する前なら `git branch -m <正しい名前>` で直せる（2026-11-02、#331 のブランチを 330 で作った）
- [ ] **CLAUDE.md・スキル（`.claude/`）の書き換えが、自動の安全確認（Self-Modification）で止められることがある**。止められたら回り道をせず、ユーザーに「なぜ止まったか・何を変えたいか」と、変える行をそのまま貼れる形（コードブロック）で渡し、ファイルの開き方（⌘P）・探し方（⌘F）・保存（⌘S）まで書く。貼ってもらったら、こちらでコミットして PR にする（2026-11-02、#329）

### 5.1 Dependabot の PR・アラートを判断するとき

CLAUDE.md「Dependabot の PR」の決まり（minor・patch は CI が通ればマージ、major は相談）に加えて、次を確かめる。

- [ ] **その部品を本当に使っているか、先に `git grep` で調べる**。`rails new` などで最初から入っていて使っていない部品なら、上げずに外す（image_processing。表紙は URL だけ保存していた。2026-11-02、PR #339）
- [ ] **gem や Docker に入れるソフトを外したら、本番用のイメージを手元でビルドして、本番の設定で起動を確かめる**（テストでは出ない起動時の警告が出る。image_processing を外したら Active Storage が「gem を入れて」と警告 → `config.active_storage.variant_processor = :disabled`）。ポートを開けずに確かめる：
  ```bash
  docker build -q -t reading-board-api-check backend
  docker run --rm -e RAILS_ENV=production -e SECRET_KEY_BASE=dummy -e APP_HOSTS=localhost -e DB_HOST=127.0.0.1 -e DB_USERNAME=x -e DB_PASSWORD=x -e DB_NAME=x reading-board-api-check bin/rails runner 'Rails.application.eager_load!; p Rails.application.call(Rack::MockRequest.env_for("/up", "HTTP_HOST" => "localhost"))[0]'
  ```
  確認用のイメージを消す `docker rmi` は許可されないことがある → 消すコマンドをユーザーに渡す
- [ ] **major の前に、その部品を中で使う道具が新しい版に対応しているかを見る**：`npm view <道具> peerDependencies`（例：TypeScript 7 は typescript-eslint が `typescript <6.1.0` まで・vue-tsc も動かず、#323 の CI が ESLint で落ちた。CI は最初に落ちた所で止まるので、PR のコードを手元で試して残りも確かめる）。未対応なら `dependabot.yml` の `ignore` に足し、**理由と外す条件をコメントに書く**（2026-11-02、PR #343）
- [ ] **PR のコードを手元で試すときは、コピーで試す**（手元の `node_modules` を上書きしない）。`rm -rf` を含むコマンドは許可されないので、新しいフォルダに取り出す：
  ```bash
  git fetch origin <PR のブランチ> && mkdir -p <scratchpad>/pr<番号> && git archive FETCH_HEAD frontend | tar -x -C <scratchpad>/pr<番号>
  ```
  Docker（Linux）でビルドするときも同じ（Mac の `node_modules` が Linux 用に置き換わるため）
- [ ] **@types/node は、動かす Node.js と同じ major にする**。Node.js の版は 3 か所にあるので、上げるときはそろえる：`.github/workflows/ci.yml` の `node-version`・`infra/templates/user_data.sh.tftpl` の `node:<版>-slim`・README の前提（Mac は Homebrew で自動で上がる）。どの版が LTS かは `https://raw.githubusercontent.com/nodejs/Release/main/schedule.json` で確かめる（2026-11-02、Mac 26・CI と本番 24 だった → PR #337）
- [ ] **`dependabot.yml` の `groups` には必ず `update-types: [minor, patch]` を付ける**。`patterns: ["*"]` だけだと major もまとめの PR に入り、1 つずつ相談できない（2026-11-02、#318 に major 3 つ → PR #335）
- [ ] **アラートの直った版が新しい major だけで、使う側の部品が古い major を指定しているとき**は、`overrides` で無理に上げない（作り手が試していない組み合わせになる）。開発用の部品だけで、外から入力が届かないなら、理由を書いて閉じる（`dismissed_reason=tolerable_risk`。いつでも開き直せる）。理由は判断の記録として残る（2026-11-02、minimatch #20）
  ```bash
  gh api -X PATCH repos/adamaru-code/reading-board/dependabot/alerts/<番号> -f state=dismissed -f dismissed_reason=tolerable_risk -f dismissed_comment="<理由と、どうなったら取り込むか>"
  ```
- [ ] `dependabot.yml` を変えたら、マージ後に Dependabot の読み直し（`gh run list` の event が `dynamic` の Update）が全部 `success` になるかを確かめる

---

## レビューの進め方（推奨）

1. **PR 単位ならまず差分のスコープを確認** — 関係ないファイルが混ざっていれば指摘
2. **Backend / Frontend / Docs / Terraform / PR フロー** の章を順番に当てる
3. 違反箇所は `file:line` 形式で列挙し、修正は影響範囲ごとに別 Issue/PR へ分割
4. 「指摘 → ユーザー判断 → 必要なら実装」の順で進める。勝手に大規模リファクタしない

### コマンドを書くときの注意（このプロジェクトのシェルは zsh）

- **`path` という名前の変数を使わない**。zsh では `path` がコマンドを探す場所（`PATH`）と結び付いているので、`while read verb path` などと書くと、その中で `sed` などが「command not found」になる（2026-10-04）。`route` などほかの名前にする **2026-11-01 にも、計測のスクリプトで `local name=$1 path=$2` と書いて同じ失敗をした**（curl・sort・wc が見つからなくなり、測った値が全部 0 ms）。zsh の関数の引数を受ける変数は `url` `target` などにする
- `grep --include=*.vue` のような `*` は**引用符で囲む**（`--include='*.vue'`）。囲まないと zsh が先に展開しようとして「no matches found」で止まる（2026-10-05 にも同じ失敗をした。grep を書いたら `*` の周りを見直す）
- 探す文字に `` ` ``（バッククォート）を入れるときは、模様を**一重引用符**で囲む。二重引用符の中の `` `q` `` はコマンドとして実行され、「command not found: q」になって模様が壊れる（2026-10-05）
- Mac の `sed` で `sed: RE error: illegal byte sequence` と出たら、日本語などをバイトのまま読む **`LC_ALL=C`** を付ける（`LC_ALL=C sed -i '' '/AIza/d' ~/.zsh_history`）。zsh の履歴ファイルは日本語を独自の形で保存しているので、そのままでは読めない。止まったときはファイルは変わっていない（2026-10-15）
- こちらのシェルの `grep` は shell function（`type grep` で分かる）で、日本語まじりのファイルを**読み飛ばして 0 件**と答えることがある。「無いこと」を数えるときは `/usr/bin/grep -a -c` を使い、あるはずの言葉（`cd ` など）も一緒に数えて、読めていることを確かめる（2026-10-15、履歴の鍵の確認）
- Rails が環境変数（鍵など）を読めているかは、`ps eww` では確かめられない（Mac はほかのプロセスの環境変数を見せない。`PATH` も 0 件）。`cd backend && mise exec -- bin/rails runner 'puts ENV["GOOGLE_BOOKS_API_KEY"].present?'` で値を出さずに確かめ、必要なら 1 回だけ実際に問い合わせる（2026-10-15）
- 削除（`rm`）を含むコマンドは許可されないことがある。ほかの処理とつなげず、分けて実行する（2026-11-01 にも、長いコマンドの途中に `rm -f` を入れて全体が許可されなかった。上書きで済むファイルは rm しない）。プロジェクトの外（`~/Downloads` など）のファイルを消すときは、ユーザーにお願いする

## 関連

- プロジェクト規約: [CLAUDE.md](../../../CLAUDE.md)
- ポート規約: [enforce-default-ports](../enforce-default-ports/SKILL.md)
- 文字入力（保存・比較・検索・重複チェック）の確認: [text-input-check](../text-input-check/SKILL.md)
- 日報と再発防止の確認（詰まったことをここに書き足す手順）: [daily-report](../daily-report/SKILL.md)
