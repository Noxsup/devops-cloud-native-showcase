# Terraform S3 Remote Backend
# Create the S3 bucket and DynamoDB table before running terraform init
#
# aws s3api create-bucket \
#   --bucket YOUR_BUCKET_NAME \
#   --region us-east-1
#
# aws dynamodb create-table \
#   --table-name terraform-lock \
#   --attribute-definitions AttributeName=LockID,AttributeType=S \
#   --key-schema AttributeName=LockID,KeyType=HASH \
#   --billing-mode PAY_PER_REQUEST

terraform {
  backend "s3" {
    bucket         = "YOUR_BUCKET_NAME"
    key            = "devops-showcase/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }

  required_version = ">= 1.3.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
  }
}
