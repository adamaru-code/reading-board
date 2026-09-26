variable "project" {
  description = "リソース名・タグ・SSM パラメータのプレフィックス"
  type        = string
  default     = "reading-board"
}

variable "aws_region" {
  description = "AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "repo_url" {
  description = "EC2 の起動時に取得するリポジトリ（公開リポジトリ）"
  type        = string
  default     = "https://github.com/adamaru-code/reading-board.git"
}

variable "git_ref" {
  description = "デプロイするブランチまたはタグ"
  type        = string
  default     = "main"
}

variable "instance_type" {
  description = "EC2 のインスタンスタイプ（Arm。Docker ビルドのためメモリ 2GB 以上）"
  type        = string
  default     = "t4g.small"
}

variable "db_instance_class" {
  description = "RDS のインスタンスクラス"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "RDS MySQL のバージョン（ローカルの Docker と同じ 8.4 系）"
  type        = string
  default     = "8.4"
}

variable "restore_snapshot_id" {
  description = "復元に使う RDS スナップショット ID。空なら新しい DB を作る（scripts/up.sh が最新の最終スナップショットを探して渡す）"
  type        = string
  default     = ""
}

variable "admin_email" {
  description = "初期管理者のメールアドレス（ログイン ID。メール送信には使わない）"
  type        = string
  default     = "admin@example.com"
}
