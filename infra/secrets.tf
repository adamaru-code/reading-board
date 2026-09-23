# シークレットは Terraform で生成して SSM Parameter Store（SecureString）に置き、
# EC2 の起動スクリプトが読み出す。値は .tf にもドキュメントにも書かない（state はローカル・gitignore 済み）

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "random_password" "secret_key_base" {
  length  = 128
  special = false
}

resource "random_password" "admin" {
  length  = 20
  special = false
}

locals {
  ssm_prefix = "/${var.project}"
}

resource "aws_ssm_parameter" "db_password" {
  name  = "${local.ssm_prefix}/db_password"
  type  = "SecureString"
  value = random_password.db.result
}

resource "aws_ssm_parameter" "secret_key_base" {
  name  = "${local.ssm_prefix}/secret_key_base"
  type  = "SecureString"
  value = random_password.secret_key_base.result
}

resource "aws_ssm_parameter" "admin_password" {
  name  = "${local.ssm_prefix}/admin_password"
  type  = "SecureString"
  value = random_password.admin.result
}
