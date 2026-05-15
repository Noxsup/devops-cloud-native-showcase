# ==============================================================
# backend.tf — Terraform Remote State Configuration
# ==============================================================
#
# WHY REMOTE STATE?
# By default, Terraform stores state locally (terraform.tfstate).
# That's fine for solo work, but breaks in teams:
#   - Two engineers run 'terraform apply' simultaneously → state corruption
#   - Local state isn't shared → teammates can't see current infra
#   - No state history → can't roll back
#
# This file configures S3 + DynamoDB as the remote backend:
#   - S3 stores the state file (versioned, encrypted at rest)
#   - DynamoDB provides distributed locking (prevents concurrent writes)
#
# SETUP (run ONCE before 'terraform init'):
#   aws s3api create-bucket \
#     --bucket YOUR_BUCKET_NAME \
#     --region us-east-1
#
#   aws dynamodb create-table \
#     --table-name terraform-lock \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST
# ==============================================================

terraform {
  # Remote backend: store state in S3 instead of locally
  backend "s3" {
    bucket         = "YOUR_BUCKET_NAME"       # S3 bucket name (must exist before init)
    key            = "devops-showcase/terraform.tfstate" # Path inside the bucket
    region         = "us-east-1"             # AWS region where bucket lives
    encrypt        = true                    # Enable server-side encryption (AES-256)
    dynamodb_table = "terraform-lock"        # DynamoDB table for state locking
  }

  # Enforce minimum Terraform version to ensure feature compatibility
  required_version = ">= 1.3.0"

  # Pin provider versions to avoid unexpected breaking changes
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"   # Allow 5.x patch/minor updates, block 6.x
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"   # Used to deploy K8s resources via Terraform
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"   # Used to install ArgoCD, Prometheus, etc. via Helm charts
    }
  }
}
