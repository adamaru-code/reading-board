output "app_url" {
  description = "アプリの URL（CloudFront）。apply 直後は EC2 の構築中で 502 になる（10 分前後）"
  value       = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "instance_id" {
  description = "EC2 のインスタンス ID（構築ログの確認に使う）"
  value       = aws_instance.app.id
}

output "admin_email" {
  description = "初期管理者のメールアドレス"
  value       = var.admin_email
}

output "admin_password_command" {
  description = "初期管理者のパスワードを表示するコマンド（値そのものは出力しない）"
  value       = "aws ssm get-parameter --region ${var.aws_region} --name ${aws_ssm_parameter.admin_password.name} --with-decryption --query Parameter.Value --output text"
}
