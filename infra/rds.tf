# RDS MySQL：プライベートサブネット・非公開・EC2 と同じ AZ。
# 「使うときだけ起動」の運用。destroy 時に最終スナップショットを取り、次回の起動でそこから復元してデータを引き継ぐ
# （scripts/up.sh・down.sh。削除保護・自動バックアップはなし）
resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db"
  subnet_ids = aws_subnet.private[*].id
}

locals {
  db_name     = "reading_board_production"
  db_username = "app"
  restoring   = var.restore_snapshot_id != ""
}

# 最終スナップショット名を起動ごとに一意にする（同名があると destroy が失敗するため）
resource "random_id" "final_snapshot" {
  byte_length = 4
}

resource "aws_db_instance" "main" {
  identifier        = "${var.project}-db"
  engine            = "mysql"
  engine_version    = var.db_engine_version
  instance_class    = var.db_instance_class
  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  # 復元時は DB 名・ユーザー名がスナップショットから引き継がれる。パスワードは復元後に今回の値へ変更される
  snapshot_identifier = local.restoring ? var.restore_snapshot_id : null
  db_name             = local.restoring ? null : local.db_name
  username            = local.restoring ? null : local.db_username
  password            = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  availability_zone      = local.azs[0]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period   = 0
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-final-${random_id.final_snapshot.hex}"
  deletion_protection       = false
  apply_immediately         = true

  tags = { Name = "${var.project}-db" }
}
