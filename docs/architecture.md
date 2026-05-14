# Architecture Overview

## DevOps Cloud-Native Showcase

This document describes the architecture of the full-stack DevOps pipeline.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Developer                             │
│                    git push → GitHub                         │
└────────────────────────┬────────────────────────────────────┘
                         │ Webhook
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Jenkins CI (EC2)                          │
│  1. Checkout code                                            │
│  2. SonarQube SAST scan                                      │
│  3. docker build (3 images)                                  │
│  4. Trivy container scan                                     │
│  5. docker push → ECR                                        │
│  6. Update K8s manifests (image tag)                         │
│  7. git push → GitHub (GitOps trigger)                       │
└────────────────────────┬────────────────────────────────────┘
                         │ GitOps sync
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ArgoCD (EKS)                              │
│  Watches deploy/k8s/ manifests                               │
│  Auto-syncs to EKS cluster on change                         │
└────────────────────────┬────────────────────────────────────┘
                         │ Deploy
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                AWS EKS Cluster                               │
│  ┌──────────────┐ ┌─────────────────┐ ┌──────────────────┐  │
│  │   frontend   │ │ product-service │ │  order-service   │  │
│  │  (port 3000) │ │   (port 4000)   │ │   (port 5000)    │  │
│  └──────────────┘ └─────────────────┘ └──────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ Metrics scrape
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Prometheus + Grafana (Helm)                     │
│  - Kubernetes cluster metrics                                │
│  - Node.js app metrics (/metrics endpoint)                   │
│  - Slack alerting via AlertManager                           │
└─────────────────────────────────────────────────────────────┘
```

## Infrastructure (Terraform)

| Resource | Details |
|---|---|
| VPC | 2 public + 2 private subnets across 2 AZs |
| EKS | Managed node group, t3.medium, 2-4 nodes |
| ECR | 3 repos: frontend, product-service, order-service |
| EC2 | Jenkins server, t3.medium, public subnet |
| IAM | Roles for EKS nodes + Jenkins IRSA |

## Security (DevSecOps)

| Tool | Stage | Purpose |
|---|---|---|
| SonarQube | CI - pre-build | SAST: code quality + vulnerability scan |
| Trivy | CI - post-build | Container image CVE scan |
| ECR Scanning | Push | AWS-native image scanning |
| K8s RBAC | Runtime | Least-privilege service accounts |

## CI/CD Flow

1. Developer pushes code to `main` branch
2. Jenkins detects webhook, starts pipeline
3. SonarQube scans code — fails build if quality gate fails
4. Docker builds 3 images in parallel
5. Trivy scans each image for HIGH/CRITICAL CVEs
6. Images pushed to ECR with git SHA tag
7. `deploy/k8s/*/deployment.yaml` updated with new image tag
8. ArgoCD detects manifest change, syncs to EKS
9. Prometheus scrapes new pods; Grafana dashboards update

## Monitoring

- **Prometheus** installed via `kube-prometheus-stack` Helm chart
- **Grafana** dashboards: Kubernetes Cluster Overview (ID: 6417), Node.js App (ID: 11159)
- **AlertManager** configured for Slack webhook notifications
- App `/metrics` endpoint exposes HTTP request count, latency histograms

## Local Development

```bash
# Run a single service locally
cd apps/frontend
npm install
npm start
# App available at http://localhost:3000
```

## Deployment Commands

```bash
# 1. Provision infrastructure
cd infra/terraform
terraform init
terraform plan
terraform apply

# 2. Configure Jenkins via Ansible
cd config/ansible
ansible-playbook -i inventory/hosts.ini playbook.yml

# 3. Install ArgoCD on EKS
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f gitops/argocd/

# 4. Install monitoring stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  -f monitoring/prometheus-values.yaml
helm upgrade --install grafana grafana/grafana \
  -f monitoring/grafana-values.yaml
```
