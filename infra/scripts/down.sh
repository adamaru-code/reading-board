#!/usr/bin/env bash
# AWS から削除する。DB は最終スナップショットを取ってから消え、次回の up.sh で復元される。
# スナップショットは最新の 1 つだけ残し、古いものは削除する（保管料を増やさないため）。
# 使い方：infra/scripts/down.sh （削除内容が表示されるので、確認して yes を入力）
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="reading-board"
REGION="ap-northeast-1"

# destroy で作られるスナップショット名を先に控える
FINAL=$(terraform output -raw final_snapshot_id)

terraform destroy

echo "最終スナップショット $FINAL の完成を待っています…"
aws rds wait db-snapshot-available --region "$REGION" --db-snapshot-identifier "$FINAL"

# 今回のもの以外の最終スナップショットを削除する
OLD=$(aws rds describe-db-snapshots --region "$REGION" \
  --db-instance-identifier "$PROJECT-db" --snapshot-type manual \
  --query "DBSnapshots[?DBSnapshotIdentifier!='$FINAL'].DBSnapshotIdentifier" --output text)
for id in $OLD; do
  echo "古いスナップショットを削除：$id"
  aws rds delete-db-snapshot --region "$REGION" --db-snapshot-identifier "$id" >/dev/null
done

echo "完了：データはスナップショット $FINAL に保存されています（次回 up.sh で復元）"
