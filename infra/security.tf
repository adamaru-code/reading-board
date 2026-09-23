# EC2：CloudFront（オリジン向けのマネージドプレフィックスリスト）からの HTTP だけ受ける。
# SSH は開けない（接続は SSM Session Manager）
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "app" {
  name        = "${var.project}-app"
  description = "EC2: HTTP from CloudFront only"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${var.project}-app" }
}

resource "aws_vpc_security_group_ingress_rule" "app_http_from_cloudfront" {
  security_group_id = aws_security_group.app.id
  description       = "HTTP from CloudFront"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

# パッケージ・GitHub・Docker Hub・SSM への通信
resource "aws_vpc_security_group_egress_rule" "app_all" {
  security_group_id = aws_security_group.app.id
  description       = "All outbound"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# RDS：EC2 の SG からの MySQL だけ受ける
resource "aws_security_group" "db" {
  name        = "${var.project}-db"
  description = "RDS: MySQL from app only"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${var.project}-db" }
}

resource "aws_vpc_security_group_ingress_rule" "db_mysql_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "MySQL from app"
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
}
