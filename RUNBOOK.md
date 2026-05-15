# 🚀 RUNBOOK: Complete Step-by-Step Deployment Guide

## 📋 Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Phase 1: AWS Infrastructure Setup](#phase-1-aws-infrastructure-setup)
- [Phase 2: Jenkins CI/CD Setup](#phase-2-jenkins-cicd-setup)
- [Phase 3: GitOps with ArgoCD](#phase-3-gitops-with-argocd)
- [Phase 4: Monitoring Stack](#phase-4-monitoring-stack)
- [Phase 5: Deploy Application](#phase-5-deploy-application)
- [Verification & Testing](#verification--testing)
- [Troubleshooting](#troubleshooting)
- [Cleanup](#cleanup)

---

## Overview

This runbook walks you through deploying a **production-grade cloud-native DevOps platform** on AWS, featuring:

- **Infrastructure**: Terraform-managed EKS cluster
- **CI/CD**: Jenkins pipeline with Docker builds, security scanning (Trivy), code analysis (SonarQube)
- **GitOps**: ArgoCD for continuous deployment
- **Monitoring**: Prometheus + Grafana with pre-built dashboards
- **Application**: Node.js microservice with health checks and metrics

**Total deployment time**: ~45-60 minutes

---

## Prerequisites

### Required Tools

Install these on your local machine:

```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version  # Should show 2.x

# Terraform
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
unzip terraform_1.7.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
terraform --version  # Should show v1.7.0+

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
kubectl version --client

# Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version

# Ansible
sudo apt update && sudo apt install -y ansible
ansible --version
```

### AWS Account Setup

1. **Create AWS Account** (if you don't have one)
   - Go to https://aws.amazon.com/console/
   - Complete signup and add payment method

2. **Create IAM User with Admin Access**
   ```bash
   # In AWS Console:
   # IAM → Users → Add User
   # Username: terraform-user
   # Access type: Programmatic access
   # Permissions: AdministratorAccess (for demo; restrict in production)
   # Save Access Key ID and Secret Access Key
   ```

3. **Configure AWS CLI**
   ```bash
   aws configure
   # AWS Access Key ID: <YOUR_ACCESS_KEY>
   # AWS Secret Access Key: <YOUR_SECRET_KEY>
   # Default region name: us-east-1
   # Default output format: json
   
   # Verify
   aws sts get-caller-identity
   ```

### Clone Repository

```bash
git clone https://github.com/Noxsup/devops-cloud-native-showcase.git
cd devops-cloud-native-showcase
```

---

## Phase 1: AWS Infrastructure Setup

### Step 1.1: Configure Terraform Backend

**Why?** Remote state allows team collaboration and prevents state corruption.

```bash
cd infra/terraform

# Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket devops-showcase-terraform-state-$(date +%s) \
  --region us-east-1

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

**Edit `backend.tf`**: Replace `YOUR_BUCKET_NAME` with your actual bucket name:
```hcl
backend "s3" {
  bucket = "devops-showcase-terraform-state-1234567890"  # Your bucket
  # ... rest stays the same
}
```

### Step 1.2: Customize Variables

Edit `terraform.tfvars` (create if it doesn't exist):

```hcl
cluster_name = "devops-showcase-eks"
aws_region   = "us-east-1"
vpc_cidr     = "10.0.0.0/16"

node_group_desired_size = 2
node_group_min_size     = 2
node_group_max_size     = 4
node_instance_type      = "t3.medium"  # 2 vCPU, 4 GB RAM

tags = {
  Environment = "development"
  Project     = "devops-showcase"
  ManagedBy   = "terraform"
}
```

### Step 1.3: Deploy EKS Cluster

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy (takes ~15-20 minutes)
terraform apply -auto-approve

# Save outputs
terraform output -json > outputs.json

# Configure kubectl to use new cluster
aws eks update-kubeconfig \
  --region us-east-1 \
  --name devops-showcase-eks

# Verify cluster access
kubectl get nodes
# Should show 2 nodes in Ready state
```

**🎯 Checkpoint**: You should see:
```
NAME                         STATUS   ROLES    AGE   VERSION
ip-10-0-1-123.ec2.internal   Ready    <none>   2m    v1.29.0
ip-10-0-2-124.ec2.internal   Ready    <none>   2m    v1.29.0
```

---

## Phase 2: Jenkins CI/CD Setup

### Step 2.1: Provision Jenkins EC2 Host

```bash
cd ../../config/ansible

# Create inventory file
cat > inventory/hosts.ini <<EOF
[jenkins]
# Replace with your EC2 public IP after launch
YOUR_EC2_PUBLIC_IP ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/your-key.pem
EOF
```

**Launch EC2 Instance Manually** (or use Terraform module):
```bash
# Via AWS Console or CLI:
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \  # Ubuntu 22.04 LTS (verify AMI ID for your region)
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxx \  # Allow ports 22, 8080, 443
  --subnet-id subnet-xxxxxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=jenkins-server}]'

# Get public IP
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=jenkins-server" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

Update `inventory/hosts.ini` with the IP address.

### Step 2.2: Run Ansible Playbook

```bash
# Test connectivity
ansible jenkins -i inventory/hosts.ini -m ping

# Deploy Jenkins and tools (takes ~10-15 minutes)
ansible-playbook -i inventory/hosts.ini playbook.yml

# Verify installation
ansible jenkins -i inventory/hosts.ini -a "jenkins --version"
ansible jenkins -i inventory/hosts.ini -a "docker --version"
```

### Step 2.3: Access Jenkins UI

```bash
# Get initial admin password
ansible jenkins -i inventory/hosts.ini -a "sudo cat /var/lib/jenkins/secrets/initialAdminPassword"

# Open browser
echo "http://$(cat inventory/hosts.ini | grep ansible_host | awk '{print $2}'):8080"
```

**Setup Steps**:
1. Paste initial admin password
2. Install suggested plugins
3. Create admin user:
   - Username: `admin`
   - Password: `<choose-secure-password>`
   - Email: `your-email@example.com`
4. Jenkins URL: `http://<YOUR_EC2_IP>:8080/`

### Step 2.4: Configure Jenkins Credentials

**Add GitHub Token**:
1. GitHub → Settings → Developer settings → Personal access tokens → Generate new token
2. Scopes: `repo`, `admin:repo_hook`
3. Jenkins → Manage Jenkins → Credentials → Global → Add Credentials
   - Kind: Secret text
   - Secret: `<YOUR_GITHUB_TOKEN>`
   - ID: `github-token`

**Add AWS Credentials**:
1. Jenkins → Credentials → Add Credentials
   - Kind: AWS Credentials
   - ID: `aws-credentials`
   - Access Key ID: `<YOUR_AWS_ACCESS_KEY>`
   - Secret Access Key: `<YOUR_AWS_SECRET_KEY>`

**Add Docker Hub Credentials** (for pushing images):
1. Jenkins → Credentials → Add Credentials
   - Kind: Username with password
   - Username: `<DOCKERHUB_USERNAME>`
   - Password: `<DOCKERHUB_PASSWORD>`
   - ID: `dockerhub-credentials`

### Step 2.5: Create Jenkins Pipeline

1. Jenkins → New Item → Pipeline
2. Name: `product-service-pipeline`
3. Pipeline → Definition: **Pipeline script from SCM**
   - SCM: Git
   - Repository URL: `https://github.com/Noxsup/devops-cloud-native-showcase.git`
   - Credentials: `github-token`
   - Branch: `*/main`
   - Script Path: `cicd/jenkins/Jenkinsfile`
4. Save

---

## Phase 3: GitOps with ArgoCD

### Step 3.1: Install ArgoCD

```bash
cd ../../gitops/argocd

# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for pods to be ready (2-3 minutes)
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
```

### Step 3.2: Access ArgoCD UI

```bash
# Expose via LoadBalancer (for demo; use Ingress in production)
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'

# Get LoadBalancer URL
kubectl get svc argocd-server -n argocd -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo
```

**Login**:
- URL: `https://<ARGOCD_LOAD_BALANCER>` (accept self-signed cert warning)
- Username: `admin`
- Password: `<paste-from-above>`

### Step 3.3: Configure ArgoCD Application

```bash
# Update application.yaml with your Git repo URL if needed
cd ../../gitops/argocd

# Apply ArgoCD application manifest
kubectl apply -f application.yaml

# Verify
kubectl get applications -n argocd
```

**In ArgoCD UI**: You should see `devops-showcase` app in "OutOfSync" state (normal — we haven't deployed yet).

---

## Phase 4: Monitoring Stack

### Step 4.1: Install Prometheus

```bash
cd ../../monitoring

# Add Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f prometheus-values.yaml \
  --wait --timeout=10m

# Verify
kubectl get pods -n monitoring
```

### Step 4.2: Install Grafana

```bash
# Add Grafana Helm repo
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Grafana
helm upgrade --install grafana grafana/grafana \
  -n monitoring \
  -f grafana-values.yaml \
  --wait

# Get LoadBalancer URL
kubectl get svc grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
echo

# Get admin password
kubectl get secret grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 -d
echo
```

**Access Grafana**:
- URL: `http://<GRAFANA_LOAD_BALANCER>:80`
- Username: `admin`
- Password: `admin` (change on first login)

**Verify Dashboards**:
- Go to Dashboards → Browse
- You should see:
  - Kubernetes Cluster Overview (7249)
  - Node Exporter Full (1860)
  - Kubernetes Pods (6336)

---

## Phase 5: Deploy Application

### Step 5.1: Update Deployment Manifest

Edit `deploy/k8s/deployment.yaml` and replace placeholders:

```yaml
image: <YOUR_DOCKERHUB_USERNAME>/product-service:latest
# Example: johnsmith/product-service:latest
```

```bash
git add deploy/k8s/deployment.yaml
git commit -m "Update image repository"
git push origin main
```

### Step 5.2: Trigger Jenkins Pipeline

```bash
# Option 1: Manual trigger via Jenkins UI
# Go to product-service-pipeline → Build Now

# Option 2: Trigger via Git push (if webhook configured)
echo "# trigger" >> README.md
git add README.md
git commit -m "Trigger pipeline"
git push origin main
```

**Pipeline Stages** (watch in Jenkins UI):
1. ✅ Checkout Code
2. ✅ Build Docker Image
3. ✅ Security Scan (Trivy)
4. ✅ SonarQube Analysis
5. ✅ Push to DockerHub
6. ✅ Update K8s Manifest
7. ✅ Push to Git

### Step 5.3: ArgoCD Auto-Sync

ArgoCD detects the Git change and deploys automatically:

```bash
# Watch deployment in real-time
kubectl get pods -n devops-prod -w

# Or watch in ArgoCD UI
# The app status should change from OutOfSync → Syncing → Synced → Healthy
```

### Step 5.4: Verify Deployment

```bash
# Check pods
kubectl get pods -n devops-prod
# NAME                              READY   STATUS    RESTARTS   AGE
# product-service-xxxxxxxxxx-xxxxx  1/1     Running   0          2m

# Check service
kubectl get svc -n devops-prod
# NAME              TYPE           CLUSTER-IP       EXTERNAL-IP                                                               PORT(S)
# product-service   LoadBalancer   10.100.123.45    a1234567890.us-east-1.elb.amazonaws.com                                   80:30123/TCP

# Test health endpoint
APP_URL=$(kubectl get svc product-service -n devops-prod -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
curl http://$APP_URL/health
# {"status":"healthy","uptime":123,"timestamp":"2026-05-15T14:00:00.000Z"}

# Test API endpoints
curl http://$APP_URL/api/products
# [{"id":1,"name":"Laptop","price":999.99,"stock":15}, ...]

curl http://$APP_URL/api/products/1
# {"id":1,"name":"Laptop","price":999.99,"stock":15}
```

---

## Verification & Testing

### ✅ Infrastructure Checks

```bash
# EKS cluster
kubectl get nodes
kubectl get namespaces

# Terraform state
cd infra/terraform
terraform show | head -20
```

### ✅ CI/CD Pipeline

```bash
# Jenkins is accessible
curl -I http://<JENKINS_IP>:8080
# HTTP/1.1 200 OK

# Pipeline executed successfully
# Check Jenkins UI → product-service-pipeline → Last build status: SUCCESS
```

### ✅ GitOps

```bash
# ArgoCD is synced
kubectl get applications -n argocd
# NAME               SYNC STATUS   HEALTH STATUS
# devops-showcase    Synced        Healthy
```

### ✅ Monitoring

```bash
# Prometheus is scraping targets
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090 &
# Open http://localhost:9090/targets
# All targets should be UP

# Grafana dashboards loading
# Open Grafana UI → Dashboards → Kubernetes Cluster
# Should show live cluster metrics
```

### ✅ Application Health

```bash
# Application responds
curl http://$APP_URL/health
# {"status":"healthy"}

# Metrics endpoint
curl http://$APP_URL/metrics
# Should show Prometheus metrics
```

---

## Troubleshooting

### Issue: EKS Nodes Not Ready

```bash
# Check node status
kubectl describe node <NODE_NAME>

# Check AWS resources
aws eks describe-cluster --name devops-showcase-eks

# Common fix: Update security groups
# Ensure nodes can reach EKS control plane (port 443)
```

### Issue: Jenkins Can't Connect to Kubernetes

```bash
# Verify kubeconfig on Jenkins server
ansible jenkins -i inventory/hosts.ini -a "kubectl get nodes"

# Copy kubeconfig if missing
scp ~/.kube/config ubuntu@<JENKINS_IP>:~/.kube/config
```

### Issue: ArgoCD Application Stuck in "Progressing"

```bash
# Check ArgoCD logs
kubectl logs -n argocd deployment/argocd-application-controller

# Manually sync
argocd app sync devops-showcase

# Check for image pull errors
kubectl describe pod -n devops-prod <POD_NAME>
```

### Issue: Prometheus Not Scraping App Metrics

```bash
# Verify service annotations
kubectl get svc product-service -n devops-prod -o yaml | grep prometheus
# Should have: prometheus.io/scrape: "true"

# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Visit http://localhost:9090/targets
```

### Issue: "ImagePullBackOff" Error

```bash
# Check image name and tag
kubectl get pod <POD_NAME> -n devops-prod -o yaml | grep image:

# Verify DockerHub image exists
docker pull <YOUR_USERNAME>/product-service:latest

# Check imagePullSecrets if repo is private
kubectl create secret docker-registry dockerhub-secret \
  --docker-username=<USERNAME> \
  --docker-password=<PASSWORD> \
  -n devops-prod
```

---

## Cleanup

**⚠️ Warning**: This will DELETE all resources and incur no further costs.

### Step 1: Delete Kubernetes Resources

```bash
# Delete application
kubectl delete namespace devops-prod

# Delete monitoring
helm uninstall monitoring -n monitoring
helm uninstall grafana -n monitoring
kubectl delete namespace monitoring

# Delete ArgoCD
kubectl delete namespace argocd
```

### Step 2: Destroy EKS Cluster

```bash
cd infra/terraform
terraform destroy -auto-approve
# Takes ~10-15 minutes
```

### Step 3: Terminate Jenkins EC2

```bash
# Find instance ID
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=jenkins-server" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text

# Terminate
aws ec2 terminate-instances --instance-ids <INSTANCE_ID>
```

### Step 4: Delete S3 Bucket & DynamoDB Table

```bash
# Empty and delete S3 bucket
aws s3 rm s3://<YOUR_BUCKET_NAME> --recursive
aws s3api delete-bucket --bucket <YOUR_BUCKET_NAME>

# Delete DynamoDB table
aws dynamodb delete-table --table-name terraform-lock
```

### Step 5: Verify Cleanup

```bash
# No running EC2 instances
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[].Instances[].InstanceId'

# No EKS clusters
aws eks list-clusters

# No LoadBalancers
aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn'
```

---

## 🎉 Success!

You've successfully deployed a production-grade cloud-native DevOps platform!

**What You Built**:
- ✅ Infrastructure-as-Code with Terraform
- ✅ EKS Kubernetes cluster with 2 worker nodes
- ✅ Jenkins CI/CD pipeline with security scanning
- ✅ GitOps workflow with ArgoCD
- ✅ Full observability with Prometheus + Grafana
- ✅ Dockerized Node.js microservice with auto-deployment

**Next Steps**:
- Add more microservices (order-service, user-service)
- Set up Ingress Controller (NGINX) for unified routing
- Configure TLS certificates with cert-manager
- Implement Horizontal Pod Autoscaling (HPA)
- Add alerting rules in Prometheus
- Integrate Slack notifications for deployments

**Questions or Issues?**
- Open an issue: https://github.com/Noxsup/devops-cloud-native-showcase/issues
- Check inline code comments in each file for detailed explanations

---

**Maintained by**: Noxsup  
**Last Updated**: May 2026  
**License**: MIT
