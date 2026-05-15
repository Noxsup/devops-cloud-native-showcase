# =============================================================
# main.tf — Provisions the entire AWS cloud infrastructure:
#   - VPC (networking layer: subnets, NAT, routing)
#   - EKS (managed Kubernetes cluster for running our apps)
#   - ECR (private Docker image registries for each microservice)
# Terraform >= 1.5 required
# =============================================================

terraform {
  # Minimum Terraform CLI version required to run this config
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0" # Use AWS provider v5.x (latest stable)
    }
  }

  # Remote backend: stores terraform.tfstate in S3 (shared, safe)
  # DynamoDB table prevents concurrent runs from corrupting state
  backend "s3" {
    bucket         = var.tf_state_bucket          # S3 bucket name (set in variables)
    key            = "devops-showcase/terraform.tfstate" # Path inside the bucket
    region         = var.aws_region               # Must match the bucket's region
    encrypt        = true                          # Encrypt state file at rest
    dynamodb_table = "terraform-locks"             # Table used for state locking
  }
}

# Configure the AWS provider with the target region
provider "aws" {
  region = var.aws_region
}

# =============================================================
# VPC — Virtual Private Cloud (networking foundation)
# Creates public + private subnets across multiple AZs.
# Public subnets: Jenkins EC2, Load Balancers
# Private subnets: EKS worker nodes (not directly internet-accessible)
# =============================================================
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  name = "${var.project_name}-vpc"  # e.g. devops-showcase-vpc
  cidr = var.vpc_cidr               # e.g. 10.0.0.0/16

  # Spread subnets across first 3 AZs for high availability
  azs  = slice(data.aws_availability_zones.available.names, 0, 3)

  private_subnets = var.private_subnets # EKS worker nodes live here
  public_subnets  = var.public_subnets  # ALBs and Jenkins EC2 live here

  enable_nat_gateway   = true  # Allows private subnet nodes to reach internet
  single_nat_gateway   = true  # Cost optimisation: one NAT for all private subnets
  enable_dns_hostnames = true  # Required for EKS to assign hostnames

  # Tags required by AWS Load Balancer Controller to discover subnets
  public_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                    = "1" # Mark as external LB subnet
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"           = "1" # Mark as internal LB subnet
  }

  tags = local.common_tags
}

# =============================================================
# EKS — Managed Kubernetes Cluster
# Worker nodes run in private subnets.
# The control plane is managed by AWS (no master nodes to manage).
# =============================================================
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.5"

  cluster_name    = var.cluster_name   # e.g. devops-showcase-cluster
  cluster_version = var.k8s_version    # e.g. "1.29"
  vpc_id          = module.vpc.vpc_id  # Attach cluster to our VPC
  subnet_ids      = module.vpc.private_subnet_ids # Nodes in private subnets

  # Allow kubectl access from the internet (restrict in production with CIDR allow-list)
  cluster_endpoint_public_access = true

  # Managed node group: AWS handles node provisioning and lifecycle
  eks_managed_node_groups = {
    main = {
      instance_types = [var.node_instance_type] # e.g. t3.medium
      min_size       = 2   # Minimum 2 nodes always running
      max_size       = 5   # Scale up to 5 under load
      desired_size   = 2   # Start with 2 nodes
      disk_size      = 20  # 20 GB EBS per node
    }
  }

  tags = local.common_tags
}

# =============================================================
# ECR — Elastic Container Registry
# One private repo per microservice.
# Jenkins pushes images here; EKS pulls from here.
# scan_on_push: AWS scans for CVEs automatically on every push.
# =============================================================
resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}/frontend"
  image_tag_mutability = "MUTABLE" # Allows re-tagging (e.g. 'latest')

  image_scanning_configuration {
    scan_on_push = true # Trigger AWS ECR vulnerability scan on every push
  }

  tags = local.common_tags
}

resource "aws_ecr_repository" "product_service" {
  name                 = "${var.project_name}/product-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

resource "aws_ecr_repository" "order_service" {
  name                 = "${var.project_name}/order-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

# =============================================================
# Data Sources — Fetch live AWS data at plan/apply time
# =============================================================

# Dynamically fetch all available AZs in the configured region
# Used above to spread subnets across AZs without hardcoding
data "aws_availability_zones" "available" {}

# =============================================================
# Locals — Reusable values computed once
# Applied as tags to every resource for cost tracking + filtering
# =============================================================
locals {
  common_tags = {
    Project     = var.project_name  # e.g. devops-showcase
    Environment = var.environment   # e.g. dev / staging / prod
    ManagedBy   = "Terraform"       # Signals this resource is IaC-managed
  }
}
