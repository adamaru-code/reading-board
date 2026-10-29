---
name: enforce-default-ports
description: reading-board プロジェクトのローカル開発サーバーを起動する前に必ず参照する。Rails API バックエンドは 3000、Vite(Vue) フロントエンドは 5173、MySQL は 3306 を必須とし、別ポートでのフォールバックを禁止する。`bin/rails server` / `npm run dev` / `docker compose up` などサーバー起動の話題が出た時に発動。
---

# ローカル開発サーバーの起動ポート（厳守）

このプロジェクトでサーバーを起動する際は、必ず以下のデフォルトポートを使用すること。
別ポートでの一時起動は**禁止**（Vite プロキシが `:3000` 固定前提のため動かない）。

| サーバー | 必須ポート |
|---|---|
| Backend (Rails API) | **3000** |
| Frontend (Vite) | **5173** |
| MySQL (Docker) | **3306** |

## 起動前チェック（必須手順）

サーバーを起動する前に、必ずポート使用状況を確認する:

```bash
lsof -i :3000
lsof -i :5173
```

判断フロー:

1. **何も出力されない** → ポートは空いている。そのまま起動してよい。
2. **プロセスが居る、かつ自分（Claude）が前のターンで起動したもの** → `kill <PID>` で停止してから起動する。
3. **プロセスが居るが、何のプロセスかわからない** → 勝手に停止せず、ユーザーに確認する。
   - `ps -p <PID> -o command=` でプロセスの素性を確認できる
4. **Vite が「Port 5173 is in use, trying another one...」と 5174 等にフォールバックした** → 即座に停止し、5173 を空けてからやり直す。

## 起動後チェック：Mac の中だけで待ち受けているか

起動したら、3 つとも **Mac の中（`127.0.0.1` / `localhost` / `[::1]`）だけ**で待ち受けているかを確かめる。`*:` や `0.0.0.0:` なら、同じ Wi-Fi のほかの機械からつながる。

```bash
lsof -i :3000 -i :5173 -i :3306 -sTCP:LISTEN -n -P | awk 'NR > 1 {print $1, $9}'
```

- OK の例：`ruby 127.0.0.1:3000`・`node [::1]:5173`・`com.docke 127.0.0.1:3306`
- `*:3306` と出たら、`docker-compose.yml` の `ports` が `"127.0.0.1:3306:3306"` になっているか見る（古い書き方のまま作ったコンテナは `docker compose up -d` で作り直すと新しい設定になる。データは消えない）
- **カフェなど家以外の Wi-Fi** で作業するときは、使わないサーバーは止める。作業を終えるときは、Rails・Vite（Ctrl+C）だけでなく **MySQL（`docker compose stop`）まで**止まったかを確かめる（Ctrl+C では MySQL は止まらない）
- 2026-10-29、カフェの Wi-Fi で MySQL が `*:3306`（root のパスワードは開発用の `password`）のまま動いていた → `127.0.0.1` に限った（#303）。Mac のファイアウォールもオフだったので、ユーザーに「システム設定 → ネットワーク → ファイアウォール」をオンにしてもらう

## なぜこのルールがあるか

- フロントの Vite プロキシは `/api → http://localhost:3000`（[frontend/vite.config.ts](../../../frontend/vite.config.ts)）。ブラウザから見て同一オリジンで API を叩くため、開発では CORS 設定は不要（[backend/config/initializers/cors.rb](../../../backend/config/initializers/cors.rb) は未構成）。

別ポートで起動すると見かけ上は立ち上がるが、ブラウザから API を叩いた瞬間に**プロキシ転送に失敗**して動かない。

## 起動コマンド（参考）

```bash
# データベース（先に起動しておく）
docker compose up -d                   # → MySQL :3306

# バックエンド
cd backend && bin/rails server         # → http://localhost:3000

# フロントエンド
cd frontend && npm run dev             # → http://localhost:5173
```

Ruby 環境は **mise**（`ruby 3.3.x`）で管理。mise が有効なシェルで起動すること。

## 関連

- プロジェクト規約: [CLAUDE.md](../../../CLAUDE.md) 第 8 章
