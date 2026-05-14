output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded cluster CA"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "ecr_frontend_url" {
  value = aws_ecr_repository.frontend.repository_url
}

output "ecr_product_service_url" {
  value = aws_ecr_repository.product_service.repository_url
}

output "ecr_order_service_url" {
  value = aws_ecr_repository.order_service.repository_url
}

output "vpc_id" {
  value = module.vpc.vpc_id
}
