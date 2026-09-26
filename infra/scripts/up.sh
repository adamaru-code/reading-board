#!/usr/bin/env bash
# AWS に起動する。前回の最終スナップショットがあれば、そこから DB を復元してデータを引き継ぐ。
# 使い方：infra/scripts/up.sh （作成内容が表示されるので、確認して yes を入力）
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="reading-board"
REGION="ap-northeast-1"

# 最新の「利用可能な」手動スナップショット（destroy 時の最終スナップショット）を探す
SNAPSHOT=$(aws rds describe-db-snapshots --region "$REGION" \
  --db-instance-identifier "$PROJECT-db" --snapshot-type manual \
  --query "reverse(sort_by(DBSnapshots[?Status=='available'], &SnapshotCreateTime))[0].DBSnapshotIdentifier" \
  --output text)
if [ "$SNAPSHOT" = "None" ]; then
  SNAPSHOT=""
  echo "スナップショットなし：新しい DB を作ります（管理者とデモ用の本を作成）"
else
  echo "スナップショット $SNAPSHOT から DB を復元します（前回のデータを引き継ぎ）"
fi

terraform init -input=false >/dev/null
terraform apply -var "restore_snapshot_id=$SNAPSHOT"

echo
echo "アプリの構築に 5 分前後かかります。完了の確認："
echo "  curl -s -o /dev/null -w '%{http_code}\\n' \"\$(terraform output -raw app_url)/up\"   # 200 で完了"
