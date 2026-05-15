# DevOps Cloud-Native Showcase

> **Full-stack DevOps pipeline:** Terraform + AWS EKS + Jenkins CI + ArgoCD GitOps + Prometheus/Grafana + DevSecOps (SonarQube + Trivy)

## Tech Stack

| Layer | Tool |
|---|---|
| Infrastructure | Terraform + AWS EKS + ECR + VPC |
| Configuration | Ansible |
| CI Pipeline | Jenkins + SonarQube + Trivy |
| CD / GitOps | ArgoCD |
| Container Runtime | Docker |
| Orchestration | Kubernetes (EKS) |
| Monitoring | Prometheus + Grafana + Alertmanager |
| Registry | Amazon ECR |

## Architecture Flow

```
Developer Push to GitHub
        |
        v
  Jenkins Pipeline
    |-- Unit Tests
    |-- SonarQube SAST
    |-- Docker Build (3 services)
    |-- Trivy CVE Scan
    |-- Push to ECR
    |-- Update K8s manifests (image tag)
        |
        v
  ArgoCD (GitOps Auto-Sync)
        |
        v
  AWS EKS Cluster (devops-prod namespace)
    |-- frontend        :3000
    |-- product-service :4000
    |-- order-service   :5000
        |
        v
  Prometheus + Grafana (Monitoring & Alerts)
```

## Repository Structure

```
.
|-- apps/
|   |-- frontend/          # Node.js frontend (port 3000)
|   |-- product-service/   # Node.js product API (port 4000)
|   |-- order-service/     # Node.js order API (port 5000)
|-- infra/terraform/       # VPC + EKS cluster + ECR repos
|-- config/ansible/        # Jenkins EC2 bootstrap
|-- cicd/jenkins/          # Jenkinsfile (CI pipeline)
|-- deploy/k8s/            # Kubernetes manifests
|-- gitops/argocd/         # ArgoCD Application manifests
|-- monitoring/            # Prometheus + Grafana Helm values
|-- .gitignore
|-- README.md
```

## Quick Start

### 1. Provision AWS Infrastructure

```bash

> **💻 Run this on: YOUR LOCAL MACHINE** (where you have AWS CLI and Terraform installed)
cd infra/terraform
export TF_VAR_tf_state_bucket=your-s3-bucket-name
terraform init
terraform plan
terraform apply
```

### 2. Bootstrap Jenkins Host (Ansible)


> **💻 Run this on: YOUR LOCAL MACHINE**
```bash
# Edit config/ansible/inventory/hosts.ini with your EC2 IP
cd config/ansible
ansible-playbook -i inventory/hosts.ini playbook.yml
```

### 3. Connect kubectl to EKS


> **💻 Run this on: YOUR LOCAL MACHINE**
```bash
aws eks update-kubeconfig --region us-east-1 --name devops-showcase-eks
```

### 4. Install ArgoCD


> **💻 Run this on: YOUR LOCAL MACHINE** (kubectl must be configured to connect to your EKS cluster)
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f gitops/argocd/application.yaml
```

### 5. Install Monitoring Stack


> **💻 Run this on: YOUR LOCAL MACHINE** (kubectl must be configured, Helm 3+ required)
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring/prometheus-values.yaml
```

### 6. Configure Jenkins

1. Open Jenkins at `http://YOUR_EC2_IP:8080`
2. Install plugins: Pipeline, Docker, AWS Steps, SonarQube Scanner, Slack Notification
3. Add credentials (see table below)
4. Create a Pipeline job pointing to this repo's `cicd/jenkins/Jenkinsfile`
5. Trigger first build — it will build all 3 images, scan, push to ECR, and update manifests

## Jenkins Credentials Required

| Credential ID | Type | Value |
|---|---|---|
| `aws-account-id` | Secret text | Your 12-digit AWS account ID |
| `aws-credentials` | AWS credentials | Access key ID + Secret access key |
| `github-credentials` | Username/Password | GitHub username + Personal Access Token |

## Values to Replace Before Use

| File | Placeholder | Replace With |
|---|---|---|
| `deploy/k8s/*/deployment.yaml` | `ACCOUNT_ID` | Your AWS account ID |
| `config/ansible/inventory/hosts.ini` | `YOUR_EC2_IP` | Jenkins EC2 public IP |
| `monitoring/prometheus-values.yaml` | `YOUR/SLACK/WEBHOOK` | Your Slack incoming webhook URL |

## Resume Line

> Built cloud-native e-commerce platform on AWS EKS with end-to-end DevSecOps pipeline: Terraform IaC for VPC/EKS/ECR, Ansible configuration management, Jenkins CI with SonarQube SAST and Trivy CVE scanning, ArgoCD GitOps delivery, and Prometheus/Grafana observability with Alertmanager.
