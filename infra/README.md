# infra（AWS 構成 B：EC2 ＋ RDS ＋ CloudFront）

読書管理ボードを AWS 上で動かす Terraform。設計・費用・決定事項は [docs/infrastructure.md](../docs/infrastructure.md) を正とする。

> **運用は「使うときだけ起動」。** 確認が終わったら必ず `terraform destroy` する。
> 起動中は EC2・RDS・パブリック IPv4 で **1 時間あたり約 $0.06（約 9 円）** かかる（2026-09 時点の概算）。停止中も DB のスナップショット 1 つ分の保管料（月数円〜数十円程度）がかかる。
> AWS Budgets の日次 $0.5・月次 $12 アラートは既存のものを使う（Terraform では作らない）。

## 構成

```
ブラウザ ─HTTPS→ CloudFront(*.cloudfront.net) ─HTTP:80→ EC2(nginx) ─┬→ SPA（frontend/dist）
                                                                    └→ /api, /up → Rails コンテナ(127.0.0.1:3000) ─3306→ RDS MySQL（プライベート）
```

- EC2 の 80 番は CloudFront からのみ（マネージドプレフィックスリスト）。SSH は開けない。
- EC2 は起動時に GitHub から `git_ref`（既定 `main`）を取得し、API を Docker でビルド・起動、フロントをビルドして nginx で配信する（`templates/user_data.sh.tftpl`）。
- シークレット（DB パスワード・SECRET_KEY_BASE・管理者パスワード）は Terraform が生成して SSM Parameter Store に置く。値は出力しない。

## 前提

- AWS CLI の認証情報（IAM ユーザー。ルートは使わない）と Terraform 1.10 以上
- デプロイしたい変更が GitHub の `main` にマージ済みであること（EC2 は GitHub から取得する）

## 起動（up.sh）

```bash
infra/scripts/up.sh   # 作成内容（27 個）が表示されるので、確認して yes を入力。約 10 分
```

- 前回 `down.sh` で保存した**最終スナップショットがあれば、そこから DB を復元**する（本・ユーザー・招待を引き継ぐ）。なければ新しい DB を作り、管理者とデモ用の本 6 冊を入れる。
- apply 後、**EC2 の構築にさらに 5 分前後**かかる（Docker ビルド。初回の実測で約 4 分）。その間 `app_url` は 502 / 504 になる。

```bash
cd infra
curl -s -o /dev/null -w '%{http_code}\n' "$(terraform output -raw app_url)/up"   # 200 になれば完了
```

### ログイン

- URL：`terraform output -raw app_url`
- メール：`terraform output -raw admin_email`（既定 `admin@example.com`）
- パスワード：`terraform output -raw admin_password_command` のコマンドを実行して表示

### 構築ログの確認（502 が続くとき）

```bash
ID=$(terraform output -raw instance_id)
CMD=$(aws ssm send-command --instance-ids "$ID" --document-name AWS-RunShellScript \
  --parameters 'commands=["tail -n 30 /var/log/reading-board-bootstrap.log"]' \
  --query Command.CommandId --output text)
sleep 5
aws ssm get-command-invocation --command-id "$CMD" --instance-id "$ID" --query StandardOutputContent --output text
```

## 停止（down.sh）

```bash
infra/scripts/down.sh   # 削除内容が表示されるので、確認して yes を入力。約 10 分
```

- DB は**最終スナップショットを取ってから削除**され、次回の `up.sh` で復元される。
- スナップショットは**最新の 1 つだけ残し**、古いものは自動で削除する。保管料はこのアプリのデータ量なら月数円〜数十円程度（概算）。
- `terraform destroy` を直接実行してもスナップショットは取られるが、古いものは消えないので `down.sh` を使う。

destroy 後に課金中のリソースが残っていないかは、`docs/infrastructure.md` §3 の確認コマンドで確かめる（スナップショットは残るのが正常）。

### データを引き継がず、まっさらから始めたいとき

スナップショットを消してから `up.sh` を実行する：

```bash
aws rds describe-db-snapshots --db-instance-identifier reading-board-db --snapshot-type manual \
  --query 'DBSnapshots[].DBSnapshotIdentifier' --output text   # 残っている ID を確認
aws rds delete-db-snapshot --db-snapshot-identifier <上で表示された ID>
```

## 変数

`terraform.tfvars`（gitignore 済み）で上書きできる。主なもの：

| 変数 | 既定 | 説明 |
|---|---|---|
| `restore_snapshot_id` | `""` | 復元するスナップショット（`up.sh` が自動で渡す。空なら新しい DB） |
| `git_ref` | `main` | デプロイするブランチ / タグ |
| `admin_email` | `admin@example.com` | 初期管理者のメール（ログイン ID） |
| `instance_type` | `t4g.small` | EC2 |
| `db_instance_class` | `db.t4g.micro` | RDS |

## 注意

- 状態ファイル（`terraform.tfstate`）はローカル保存。シークレットを含むのでコミットしない（gitignore 済み）。
- RDS は削除保護・自動バックアップなし。データは destroy 時の最終スナップショット（最新 1 つ）で次回に引き継ぐ。
- **管理者（`admin_email`）のパスワードは起動のたびに新しくなる**（復元した DB でも、起動時に `admin:ensure` で SSM の値に合わせる）。毎回 `admin_password_command` のコマンドで確認する。他のユーザーのパスワードは引き継がれる。
- CloudFront のキャッシュは SPA のみ。`/api/*` と `/up` はキャッシュしない。
