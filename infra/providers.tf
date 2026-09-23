provider "aws" {
  region = var.aws_region

  # 全リソースに付けるタグ（コスト確認・消し忘れの確認用）
  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}
