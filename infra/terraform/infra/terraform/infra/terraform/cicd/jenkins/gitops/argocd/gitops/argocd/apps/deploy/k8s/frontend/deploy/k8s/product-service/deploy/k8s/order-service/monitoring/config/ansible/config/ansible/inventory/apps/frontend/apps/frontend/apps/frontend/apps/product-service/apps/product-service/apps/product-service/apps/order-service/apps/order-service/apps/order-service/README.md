# DevOps Cloud-Native Showcase

> **Full-stack DevOps pipeline:** Terraform + AWS EKS + Jenkins CI + ArgoCD GitOps + Prometheus/Grafana + DevSecOps (SonarQube + Trivy)

![Architecture](docs/architecture.png)

## Tech Stack

| Layer | Tool |
|---|---|
| Infrastructure | Terraform + AWS EKS + ECR + VPC |
| Configuration | Ansible |
| CI Pipeline | Jenkins + SonarQube + Trivy |
| CD / GitOps | ArgoCD |
| Container Runtime | Docker |
| Orchestration | Kubernetes |
| Monitoring | Prometheus + Grafana + Alertmanager |
| Source Control | GitHub |

## Architecture

```
Developer Push
     │
     ▼
GitHub Repo
     │
     ▼
Jenkins Pipeline
  ├─ Unit Tests
  ├─ SonarQube (SAST)
  ├─ Docker Build
  ├─ Trivy Scan (CVE)
  ├─ Push to ECR
  └─ Update K8s manifests (image tag)
     │
     ▼
ArgoCD (GitOps sync)
     │
     ▼
AWS EKS Cluster
  ├─ frontend        :3000
  ├─ product-service :4000
  └─ order-service   :5000
     │
     ▼
Prometheus + Grafana (Monitoring)
```

## Repo Structure

```
.
├── apps/
│   ├── frontend/          # Node.js frontend service
│   ├── product-service/   # Node.js product API
│   └── order-service/     # Node.js order API
├── infra/terraform/       # VPC + EKS + ECR
├── config/ansible/        # Jenkins host bootstrap
├── cicd/jenkins/          # Jenkinsfile
├── deploy/k8s/            # K8s Deployments + Services
├── gitops/argocd/         # ArgoCD Applications
└── monitoring/            # Prometheus + Grafana Helm values
```

## Quick Start

### 1. Provision Infrastructure

```bash
cd infra/terraform
export TF_VAR_tf_state_bucket=your-bucket-name
terraform init
terraform plan
terraform apply
```

### 2. Bootstrap Jenkins Host

```bash
# Update config/ansible/inventory/hosts.ini with your EC2 IP
cd config/ansible
ansible-playbook -i inventory/hosts.ini playbook.yml
```

### 3. Configure kubeconfig

```bash
aws eks update-kubeconfig --region us-east-1 --name devops-showcase-eks
```

### 4. Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f gitops/argocd/application.yaml
```

### 5. Install Monitoring Stack

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring/prometheus-values.yaml
```

### 6. Jenkins Setup

1. Open Jenkins at `http://YOUR_EC2_IP:8080`
2. Install plugins: Pipeline, Docker, AWS Steps, SonarQube, Slack
3. Add credentials: `aws-account-id`, `aws-credentials`, `github-credentials`
4. Create Pipeline job pointing to this repo
5. First run builds and pushes all 3 service images

## Required Values to Substitute

| File | Placeholder | Replace With |
|---|---|---|
| `deploy/k8s/*/deployment.yaml` | `ACCOUNT_ID` | Your AWS account ID |
| `config/ansible/inventory/hosts.ini` | `YOUR_EC2_IP` | Jenkins EC2 public IP |
| `monitoring/prometheus-values.yaml` | `YOUR/SLACK/WEBHOOK` | Slack webhook URL |

## Jenkins Credentials Required

| ID | Type | Value |
|---|---|---|
| `aws-account-id` | Secret text | AWS account ID |
| `aws-credentials` | AWS credentials | Access key + secret |
| `github-credentials` | Username/password | GitHub username + PAT |

## Resume Line

> Built cloud-native e-commerce platform on AWS EKS with full DevSecOps pipeline: Terraform IaC, Ansible configuration management, Jenkins CI with SonarQube SAST and Trivy CVE scanning, ArgoCD GitOps delivery, and Prometheus/Grafana observability stack.