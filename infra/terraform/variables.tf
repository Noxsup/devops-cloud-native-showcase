# =============================================================
# variables.tf — All configurable inputs for this Terraform project.
# Override defaults by passing -var="key=value" or via terraform.tfvars
# =============================================================

# AWS region where ALL resources will be created
# Change to ap-south-1 for Mumbai, eu-west-1 for Ireland, etc.
variable "aws_region" {
  description = "AWS region to deploy all resources into"
  type        = string
  default     = "us-east-1"
}

# Prefix applied to every resource name (VPC, EKS, ECR, etc.)
# Keeps resources identifiable and avoids naming conflicts
variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
  default     = "devops-showcase"
}

# Deployment environment tag — used for cost tracking and conditional logic
# Typical values: dev, staging, prod
variable "environment" {
  description = "Deployment environment (dev / staging / prod)"
  type        = string
  default     = "prod"
}

# Name of the EKS cluster — referenced by kubectl and ArgoCD
variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "devops-showcase-eks"
}

# Kubernetes version for the EKS control plane and managed node groups
# Check AWS docs for supported versions before upgrading
variable "k8s_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.29"
}

# VPC CIDR block — the overall IP range for the entire network
# /16 gives 65,536 IPs to divide across subnets
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# Private subnet CIDRs — EKS worker nodes live here
# Not directly reachable from the internet; use NAT for outbound traffic
variable "private_subnets" {
  description = "List of private subnet CIDR blocks (for EKS nodes)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

# Public subnet CIDRs — Jenkins EC2 and Load Balancers live here
# Directly reachable from the internet via Internet Gateway
variable "public_subnets" {
  description = "List of public subnet CIDR blocks (for ALBs and Jenkins)"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

# EC2 instance type for EKS worker nodes
# t3.medium = 2 vCPU, 4 GB RAM — suitable for dev/staging
# Use m5.large or c5.xlarge for production workloads
variable "node_instance_type" {
  description = "EC2 instance type for EKS managed node group"
  type        = string
  default     = "t3.medium"
}

# S3 bucket name for storing Terraform remote state
# Must be globally unique; create it manually before running terraform init
variable "tf_state_bucket" {
  description = "S3 bucket name for Terraform remote state storage"
  type        = string
  # No default — must be explicitly provided (avoids accidental overwrites)
}
