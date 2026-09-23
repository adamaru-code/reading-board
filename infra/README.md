# infra（AWS 構成 B：EC2 ＋ RDS ＋ CloudFront）

読書管理ボードを AWS 上で動かす Terraform。設計・費用・決定事項は [docs/infrastructure.md](../docs/infrastructure.md) を正とする。

> **運用は「使うときだけ起動」。** 確認が終わったら必ず `terraform destroy` する。
> 起動中は EC2・RDS・パブリック IPv4 で **1 時間あたり約 $0.06（約 9 円）** かかる（2026-09 時点の概算）。
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

## 起動（apply）

```bash
cd infra
terraform init
terraform plan -out=tfplan   # 作成されるリソースを確認（26 個）
terraform apply tfplan       # 10〜15 分（RDS と CloudFront の作成待ち）
```

apply 後、**EC2 の構築にさらに 10 分前後**かかる（Docker ビルド）。その間 `app_url` は 502 / 504 になる。

```bash
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

## 停止（destroy）

```bash
terraform destroy   # 10 分前後（CloudFront の無効化待ち）。DB のデータも消える
```

destroy 後に課金中のリソースが残っていないかは、コンソールの EC2・RDS・CloudFront、または `docs/infrastructure.md` §3 の確認コマンドで確かめる。

## 変数

`terraform.tfvars`（gitignore 済み）で上書きできる。主なもの：

| 変数 | 既定 | 説明 |
|---|---|---|
| `git_ref` | `main` | デプロイするブランチ / タグ |
| `admin_email` | `admin@example.com` | 初期管理者のメール（ログイン ID） |
| `instance_type` | `t4g.small` | EC2 |
| `db_instance_class` | `db.t4g.micro` | RDS |

## 注意

- 状態ファイル（`terraform.tfstate`）はローカル保存。シークレットを含むのでコミットしない（gitignore 済み）。
- RDS は最終スナップショット・削除保護・自動バックアップなし（destroy で確実に消すため）。データを残したい場合は destroy 前に自分でスナップショットを取る。
- CloudFront のキャッシュは SPA のみ。`/api/*` と `/up` はキャッシュしない。
