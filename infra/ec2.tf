# EC2：Amazon Linux 2023（Arm）。起動スクリプト（templates/user_data.sh.tftpl）でアプリを構築する
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_instance" "app" {
  ami                    = nonsensitive(data.aws_ssm_parameter.al2023_arm64.value)
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  # IMDSv2 のみ
  metadata_options {
    http_tokens = "required"
  }

  # Docker イメージ（Ruby・Node）のビルドに余裕を持たせる
  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = templatefile("${path.module}/templates/user_data.sh.tftpl", {
    region      = var.aws_region
    ssm_prefix  = local.ssm_prefix
    repo_url    = var.repo_url
    git_ref     = var.git_ref
    db_host     = aws_db_instance.main.address
    db_username = aws_db_instance.main.username
    db_name     = aws_db_instance.main.db_name
    admin_email = var.admin_email
    nginx_conf  = file("${path.module}/templates/nginx.conf")
  })
  user_data_replace_on_change = true

  # 起動スクリプトが読む SSM パラメータと、読むための権限を先に用意する
  depends_on = [
    aws_iam_role_policy.app_read_params,
    aws_ssm_parameter.db_password,
    aws_ssm_parameter.secret_key_base,
    aws_ssm_parameter.admin_password,
  ]

  # 新しい AMI が出ても、起動中のインスタンスを作り直さない
  lifecycle {
    ignore_changes = [ami]
  }

  tags = { Name = "${var.project}-app" }
}
