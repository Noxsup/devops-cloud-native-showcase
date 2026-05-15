# Pre-Deployment Checklist - DevOps Cloud-Native Showcase

## ⚠️ CRITICAL: Complete ALL Steps Before Deployment

This checklist contains **mandatory changes** required before deploying this cloud-native DevOps showcase. Every placeholder value MUST be replaced with your actual AWS environment details.

**Project Stack:** Terraform + AWS EKS + Jenkins CI + ArgoCD + Prometheus/Grafana + DevSecOps (SonarQube + Trivy)

---

## 📋 Required Changes by File

### 1️⃣ Terraform Infrastructure Configuration

#### File: `infra/terraform/variables.tf` or `terraform.tfvars`
**WHAT TO CHANGE:**
```hcl
# CHANGE THESE DEFAULT VALUES:
variable "aws_region" {
  default = "us-east-1"  # ← Replace with your preferred AWS region (us-east-1, us-west-2, ap-south-1, etc.)
}

variable "cluster_name" {
  default = "YOUR_EKS_CLUSTER_NAME"  # ← Your EKS cluster name (e.g., "devops-showcase-eks")
}

variable "vpc_cidr" {
  default = "10.0.0.0/16"  # ← Adjust if needed to avoid conflicts
}

variable "ecr_repository_name" {
  default = "YOUR_ECR_REPO_NAME"  # ← Your ECR repository name
}

variable "node_instance_type" {
  default = "t3.medium"  # ← Change based on workload (t3.medium, t3.large, etc.)
}

variable "desired_capacity" {
  default = 2  # ← Number of worker nodes (2-5 recommended for dev)
}

variable "environment" {
  default = "dev"  # ← dev, staging, or prod
}
```

**HOW TO CHANGE:**
```bash
# LOCATION: Open infra/terraform/ directory
cd infra/terraform

# METHOD 1: Edit variables.tf directly
code variables.tf

# METHOD 2: Create terraform.tfvars file (RECOMMENDED)
cat > terraform.tfvars <<EOF
aws_region          = "us-west-2"
cluster_name        = "devops-showcase-eks"
ecr_repository_name = "microservices-demo"
node_instance_type  = "t3.medium"
desired_capacity    = 3
environment         = "dev"
EOF
```

**WHERE TO RUN:** In `infra/terraform/` directory

**VALIDATION:**
```bash
# After changes, run:
terraform init
terraform validate
terraform plan

# Expected output: Plan should show resources to be created with YOUR values
# Check: cluster_name, region, ECR repo names all match your inputs
```

---

### 2️⃣ AWS Configuration

#### File: `~/.aws/credentials` and `~/.aws/config`
**WHAT TO SETUP:**
You need AWS credentials configured locally

**HOW TO SETUP:**
```bash
# Check if AWS CLI is installed
aws --version
# If not: brew install awscli  (macOS) or apt install awscli (Linux)

# Configure AWS credentials
aws configure
# Provide:
# - AWS Access Key ID: YOUR_ACCESS_KEY
# - AWS Secret Access Key: YOUR_SECRET_KEY
# - Default region: us-west-2 (or your region)
# - Default output format: json

# Verify configuration
aws sts get-caller-identity
# Expected: Should show your AWS account ID and IAM user/role
```

**WHERE TO RUN:** Local terminal

**VALIDATION:**
```bash
# Test AWS access
aws eks list-clusters
aws ecr describe-repositories
# Expected: No permission errors (may show empty list initially)
```

---

### 3️⃣ Kubernetes Deployment Manifests

#### File: `deploy/k8s/*/deployment.yaml` (Multiple services)
**WHAT TO CHANGE:**
All container image references must use YOUR ECR repository URL

**Example - Frontend Service:**
```yaml
# File: deploy/k8s/frontend/deployment.yaml
spec:
  containers:
  - name: frontend
    image: YOUR_AWS_ACCOUNT_ID.dkr.ecr.YOUR_REGION.amazonaws.com/YOUR_ECR_REPO:frontend  # ← CHANGE THIS
```

**Example - Product Service:**
```yaml
# File: deploy/k8s/product-service/deployment.yaml
spec:
  containers:
  - name: product-service
    image: YOUR_AWS_ACCOUNT_ID.dkr.ecr.YOUR_REGION.amazonaws.com/YOUR_ECR_REPO:product-service  # ← CHANGE THIS
```

**HOW TO CHANGE (Automated):**
```bash
# Get your AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="us-west-2"  # Your region
ECR_REPO="microservices-demo"  # Your ECR repo name

# Replace placeholders in all deployment files
find deploy/k8s -name "deployment.yaml" -exec sed -i.bak \
  "s|YOUR_AWS_ACCOUNT_ID|${AWS_ACCOUNT_ID}|g; \
   s|YOUR_REGION|${AWS_REGION}|g; \
   s|YOUR_ECR_REPO|${ECR_REPO}|g" {} \;

# Remove backup files
find deploy/k8s -name "*.bak" -delete
```

**WHERE TO RUN:** Project root directory

**VALIDATION:**
```bash
# Verify all placeholders are replaced
grep -r "YOUR_AWS_ACCOUNT_ID" deploy/k8s/
grep -r "YOUR_REGION" deploy/k8s/
grep -r "YOUR_ECR_REPO" deploy/k8s/

# Expected: No matches (all placeholders replaced)

# Check one deployment file
cat deploy/k8s/frontend/deployment.yaml | grep image:
# Expected: Should show full ECR URL like:
# image: 123456789012.dkr.ecr.us-west-2.amazonaws.com/microservices-demo:frontend
```

---

### 4️⃣ Jenkins Pipeline Configuration

#### File: `cicd/jenkins/Jenkinsfile`
**WHAT TO CHANGE:**
```groovy
environment {
    AWS_REGION = 'YOUR_AWS_REGION'                    # ← Your AWS region
    AWS_ACCOUNT_ID = 'YOUR_AWS_ACCOUNT_ID'            # ← Your AWS account ID
    ECR_REPO = 'YOUR_ECR_REPO_NAME'                   # ← Your ECR repository name
    EKS_CLUSTER_NAME = 'YOUR_EKS_CLUSTER_NAME'        # ← Your EKS cluster name
    SONARQUBE_URL = 'YOUR_SONARQUBE_URL'              # ← SonarQube server URL
    SONARQUBE_TOKEN = credentials('sonarqube-token')  # ← Jenkins credential ID
}
```

**HOW TO CHANGE:**
```bash
# Edit Jenkinsfile
code cicd/jenkins/Jenkinsfile

# Replace with your actual values:
# - YOUR_AWS_REGION → us-west-2
# - YOUR_AWS_ACCOUNT_ID → 123456789012
# - YOUR_ECR_REPO_NAME → microservices-demo
# - YOUR_EKS_CLUSTER_NAME → devops-showcase-eks
# - YOUR_SONARQUBE_URL → http://sonarqube.yourdomain.com (or http://localhost:9000)
```

**WHERE TO RUN:** Project root or Jenkins UI

**VALIDATION:**
```bash
# Check Jenkinsfile for placeholders
grep "YOUR_" cicd/jenkins/Jenkinsfile
# Expected: No matches

# Verify environment variables are set
grep "AWS_REGION" cicd/jenkins/Jenkinsfile
grep "ECR_REPO" cicd/jenkins/Jenkinsfile
# Expected: Should show your actual values, not placeholders
```

---

### 5️⃣ ArgoCD Application Manifests

#### File: `gitops/argocd/apps/*.yaml`
**WHAT TO CHANGE:**
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: frontend
  namespace: argocd
spec:
  source:
    repoURL: 'https://github.com/YOUR_GITHUB_USERNAME/devops-cloud-native-showcase'  # ← Your GitHub repo
    targetRevision: main
    path: deploy/k8s/frontend
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: YOUR_NAMESPACE  # ← Your Kubernetes namespace (e.g., production)
```

**HOW TO CHANGE:**
```bash
# Replace GitHub username and namespace
GITHUB_USER="Noxsup"  # Your GitHub username
NAMESPACE="production"  # Your target namespace

find gitops/argocd/apps -name "*.yaml" -exec sed -i \
  "s|YOUR_GITHUB_USERNAME|${GITHUB_USER}|g; \
   s|YOUR_NAMESPACE|${NAMESPACE}|g" {} \;
```

**WHERE TO RUN:** Project root directory

**VALIDATION:**
```bash
# Verify ArgoCD manifests
grep -r "YOUR_GITHUB_USERNAME" gitops/argocd/
grep -r "YOUR_NAMESPACE" gitops/argocd/
# Expected: No matches
```

---

### 6️⃣ Monitoring Configuration

#### File: `monitoring/prometheus/values.yaml` and `monitoring/grafana/values.yaml`
**WHAT TO CHANGE:**
```yaml
# Prometheus values.yaml
server:
  ingress:
    hosts:
      - prometheus.YOUR_DOMAIN.com  # ← Your domain

# Grafana values.yaml
ingress:
  hosts:
    - grafana.YOUR_DOMAIN.com  # ← Your domain
adminPassword: CHANGE_ME  # ← Strong admin password
```

**HOW TO CHANGE:**
```bash
# Edit Helm values files
code monitoring/prometheus/values.yaml
code monitoring/grafana/values.yaml

# Replace:
# - YOUR_DOMAIN.com → yourdomain.com (or use LoadBalancer IP)
# - CHANGE_ME → Strong password (store securely!)
```

**WHERE TO RUN:** Editing in local IDE

**VALIDATION:**
```bash
# Check for placeholders
grep "YOUR_DOMAIN" monitoring/
grep "CHANGE_ME" monitoring/
# Expected: No matches
```

---

## 🔧 Deployment Execution Order

### Step 1: Prepare Local Environment
```bash
# Install required tools
# - AWS CLI
# - kubectl
# - terraform
# - helm

# Verify installations
aws --version        # Expected: aws-cli/2.x.x or higher
kubectl version      # Expected: Client version v1.28+
terraform version    # Expected: Terraform v1.5+
helm version         # Expected: v3.12+

# Configure AWS credentials (if not done)
aws configure
```

### Step 2: Update All Configuration Files
```bash
# 1. Update Terraform variables
cd infra/terraform
cat > terraform.tfvars <<EOF
aws_region          = "us-west-2"
cluster_name        = "devops-showcase-eks"
ecr_repository_name = "microservices-demo"
node_instance_type  = "t3.medium"
desired_capacity    = 3
environment         = "dev"
EOF

# 2. Get AWS account details
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION="us-west-2"
export ECR_REPO="microservices-demo"

# 3. Update K8s manifests
cd ../..
find deploy/k8s -name "deployment.yaml" -exec sed -i \
  "s|YOUR_AWS_ACCOUNT_ID|${AWS_ACCOUNT_ID}|g; \
   s|YOUR_REGION|${AWS_REGION}|g; \
   s|YOUR_ECR_REPO|${ECR_REPO}|g" {} \;

# 4. Update ArgoCD apps
find gitops/argocd/apps -name "*.yaml" -exec sed -i \
  "s|YOUR_GITHUB_USERNAME|Noxsup|g; \
   s|YOUR_NAMESPACE|production|g" {} \;

# 5. Manually edit Jenkins and monitoring configs
# (See sections above for exact changes)
```

### Step 3: Deploy Infrastructure with Terraform
```bash
# LOCATION: infra/terraform/ directory
cd infra/terraform

# Initialize Terraform
terraform init
# EXPECTED: Initializing provider plugins... Success!

# Preview infrastructure changes
terraform plan
# EXPECTED: Plan to create ~20-30 resources (VPC, EKS, ECR, IAM, etc.)
# CHECK: Cluster name, region, ECR repo all match YOUR values

# Apply infrastructure
terraform apply
# WHEN PROMPTED: Type 'yes'
# WAIT: ~15-20 minutes for EKS cluster creation
# EXPECTED: "Apply complete! Resources: 25+ added"

# Save important outputs
terraform output
# Note: EKS cluster endpoint, ECR repository URL, etc.
```

### Step 4: Configure kubectl for EKS
```bash
# Update kubeconfig to access EKS cluster
aws eks update-kubeconfig \
  --region us-west-2 \
  --name devops-showcase-eks

# EXPECTED: "Added new context arn:aws:eks:..."

# Verify cluster access
kubectl get nodes
# EXPECTED: 2-3 nodes in Ready status

kubectl get namespaces
# EXPECTED: default, kube-system, kube-public
```

### Step 5: Setup Jenkins CI
```bash
# Deploy Jenkins to EKS
cd cicd/jenkins
kubectl create namespace jenkins
kubectl apply -f jenkins-deployment.yaml
kubectl apply -f jenkins-service.yaml

# Get Jenkins external URL
kubectl get svc -n jenkins
# EXPECTED: External LoadBalancer URL/IP

# Get initial admin password
kubectl exec -n jenkins $(kubectl get pods -n jenkins -l app=jenkins -o name) -- \
  cat /var/jenkins_home/secrets/initialAdminPassword

# Access Jenkins UI
# URL: http://<EXTERNAL-IP>:8080
# Complete setup wizard and install suggested plugins

# Configure Jenkins credentials:
# - AWS credentials (Access Key/Secret Key)
# - GitHub token (for repo access)
# - SonarQube token
# - Docker registry credentials (for ECR)
```

### Step 6: Build and Push Docker Images
```bash
# Login to ECR
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin \
  ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com

# EXPECTED: "Login Succeeded"

# Build images for each microservice
cd apps/frontend
docker build -t ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com/microservices-demo:frontend .
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com/microservices-demo:frontend

cd ../product-service
docker build -t ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com/microservices-demo:product-service .
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com/microservices-demo:product-service

# Repeat for: order-service, inventory-service, etc.

# Verify images in ECR
aws ecr describe-images --repository-name microservices-demo
# EXPECTED: List of pushed images with tags
```

### Step 7: Deploy Applications to Kubernetes
```bash
# Create application namespace
kubectl create namespace production

# Deploy each microservice
kubectl apply -f deploy/k8s/frontend/ -n production
kubectl apply -f deploy/k8s/product-service/ -n production
kubectl apply -f deploy/k8s/order-service/ -n production
# ... repeat for all services

# Check deployment status
kubectl get deployments -n production
kubectl get pods -n production
# EXPECTED: All pods in Running status

# Get service endpoints
kubectl get svc -n production
# WAIT: 2-3 minutes for LoadBalancer external IPs
# EXPECTED: External IPs/URLs assigned
```

### Step 8: Setup ArgoCD for GitOps
```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# WAIT: ~2 minutes for ArgoCD pods to be ready
kubectl get pods -n argocd

# Get ArgoCD admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# Access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# URL: https://localhost:8080
# Username: admin
# Password: (from above command)

# Deploy ArgoCD applications
kubectl apply -f gitops/argocd/apps/

# Verify applications in ArgoCD UI
# All apps should show "Healthy" and "Synced"
```

### Step 9: Deploy Monitoring Stack
```bash
# Add Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus
kubectl create namespace monitoring
helm install prometheus prometheus-community/prometheus \
  -n monitoring \
  -f monitoring/prometheus/values.yaml

# Install Grafana
helm install grafana grafana/grafana \
  -n monitoring \
  -f monitoring/grafana/values.yaml

# Get Grafana admin password
kubectl get secret --namespace monitoring grafana \
  -o jsonpath="{.data.admin-password}" | base64 --decode ; echo

# Access Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80
# URL: http://localhost:3000
# Username: admin
# Password: (from above or values.yaml)

# Import dashboards:
# - Kubernetes Cluster Monitoring (ID: 6417)
# - Node Exporter Full (ID: 1860)
# - ArgoCD (ID: 14584)
```

### Step 10: Setup DevSecOps Tools
```bash
# Deploy SonarQube
kubectl create namespace devsecops
kubectl apply -f config/sonarqube/sonarqube-deployment.yaml -n devsecops

# Get SonarQube URL
kubectl get svc -n devsecops sonarqube
# Access: http://<EXTERNAL-IP>:9000
# Default: admin / admin (change immediately!)

# Generate SonarQube token
# UI: Administration → Security → Users → Tokens → Generate
# Save token for Jenkins

# Configure Trivy scanning in Jenkins pipeline
# (Already included in Jenkinsfile if updated)
```

### Step 11: Create Jenkins Pipeline
```bash
# In Jenkins UI:
# 1. New Item → Pipeline
# 2. Name: "Microservices-CI-CD"
# 3. Pipeline definition: "Pipeline script from SCM"
# 4. SCM: Git
# 5. Repository URL: https://github.com/Noxsup/devops-cloud-native-showcase
# 6. Script Path: cicd/jenkins/Jenkinsfile
# 7. Save

# Trigger first build
# Click "Build Now"
# Monitor console output

# Expected stages:
# ✅ Checkout
# ✅ Build Docker Images
# ✅ SonarQube Scan
# ✅ Trivy Security Scan
# ✅ Push to ECR
# ✅ Update K8s Manifests
# ✅ Deploy to EKS (via ArgoCD sync)
```

---

## ✅ Final Validation Checklist

### Infrastructure Validation
- [ ] `terraform plan` shows no changes (infrastructure is stable)
- [ ] EKS cluster is running and accessible via kubectl
- [ ] ECR repository exists and contains images
- [ ] VPC, subnets, and security groups are configured
- [ ] IAM roles for EKS nodes and pods are created

### Kubernetes Validation
- [ ] `kubectl get nodes` shows all nodes Ready
- [ ] All deployments in production namespace are available
- [ ] All pods are in Running status
- [ ] Services have external LoadBalancer IPs assigned
- [ ] Ingress controller is working (if configured)

### CI/CD Validation
- [ ] Jenkins is accessible and configured
- [ ] Jenkins pipeline runs successfully end-to-end
- [ ] Docker images build and push to ECR
- [ ] SonarQube scan completes
- [ ] Trivy security scan runs
- [ ] ArgoCD is installed and accessible
- [ ] ArgoCD applications are synced and healthy

### Monitoring Validation
- [ ] Prometheus is scraping metrics from all targets
- [ ] Grafana dashboards display cluster metrics
- [ ] Alerts are configured (if applicable)
- [ ] Logs are being collected (if ELK/Loki configured)

### Security Validation
- [ ] SonarQube quality gate passes
- [ ] Trivy vulnerability scan shows acceptable risk level
- [ ] AWS IAM least privilege policies applied
- [ ] Kubernetes RBAC configured
- [ ] Secrets stored in AWS Secrets Manager or K8s secrets

### Configuration Validation
```bash
# Run these commands to verify all values are updated:

# Check Terraform
grep -r "YOUR_" infra/terraform/
# EXPECTED: No matches (all placeholders replaced)

# Check Kubernetes manifests
grep -r "YOUR_AWS_ACCOUNT_ID" deploy/k8s/
grep -r "YOUR_REGION" deploy/k8s/
# EXPECTED: No matches

# Check Jenkins pipeline
grep "YOUR_" cicd/jenkins/Jenkinsfile
# EXPECTED: No matches

# Check ArgoCD apps
grep "YOUR_GITHUB_USERNAME" gitops/argocd/
# EXPECTED: No matches
```

---

## 🚨 Common Issues and Fixes

### Issue 1: EKS Cluster Creation Fails
**Error:** `Error: error creating EKS Cluster: LimitExceededException`
**Fix:** You've hit AWS service limits. Request limit increase:
```bash
# Check current limits
aws service-quotas list-service-quotas --service-code eks

# Request increase via AWS Console:
# Service Quotas → Amazon Elastic Kubernetes Service → Request quota increase
```

### Issue 2: ECR Push Access Denied
**Error:** `denied: Your authorization token has expired`
**Fix:** Re-authenticate with ECR:
```bash
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin \
  ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com
```

### Issue 3: kubectl Cannot Connect to Cluster
**Error:** `The connection to the server localhost:8080 was refused`
**Fix:** Update kubeconfig:
```bash
aws eks update-kubeconfig --region us-west-2 --name devops-showcase-eks
kubectl config get-contexts
kubectl config use-context <your-eks-context>
```

### Issue 4: Pods Stuck in ImagePullBackOff
**Error:** `Failed to pull image: authorization failed`
**Fix:** Ensure EKS nodes have ECR pull permissions:
```bash
# Check node IAM role has AmazonEC2ContainerRegistryReadOnly policy
aws iam list-attached-role-policies --role-name <eks-node-role>

# If missing, attach policy:
aws iam attach-role-policy \
  --role-name <eks-node-role> \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
```

### Issue 5: Jenkins Cannot Access EKS
**Error:** `error: You must be logged in to the server (Unauthorized)`
**Fix:** Configure Jenkins with proper AWS credentials and kubeconfig:
```bash
# In Jenkins pod, configure AWS CLI
kubectl exec -n jenkins <jenkins-pod> -- aws configure

# Update kubeconfig in Jenkins
kubectl exec -n jenkins <jenkins-pod> -- \
  aws eks update-kubeconfig --region us-west-2 --name devops-showcase-eks

# Or use Kubernetes plugin with service account
```

### Issue 6: Terraform State Lock Error
**Error:** `Error locking state: ConditionalCheckFailedException`
**Fix:** Another Terraform process is running or crashed:
```bash
# Force unlock (use with caution!)
terraform force-unlock <LOCK-ID>

# Better: Use S3 backend with DynamoDB for state locking
# Add to backend.tf:
terraform {
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "devops-showcase/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

### Issue 7: ArgoCD Application OutOfSync
**Error:** Application shows "OutOfSync" status in ArgoCD
**Fix:** Sync the application:
```bash
# Via CLI:
argocd app sync <app-name>

# Or force sync:
argocd app sync <app-name> --force

# Via UI:
# Click application → SYNC → SYNCHRONIZE
```

### Issue 8: SonarQube Quality Gate Failing
**Error:** Pipeline fails at SonarQube quality gate
**Fix:** Review and fix code quality issues:
```bash
# Access SonarQube UI to view issues
# URL: http://<sonarqube-url>:9000

# Common fixes:
# - Code smells: Refactor code
# - Security hotspots: Review and mark as safe or fix
# - Coverage: Add more unit tests

# Temporarily bypass (NOT recommended for production):
# In Jenkinsfile, comment out:
# waitForQualityGate abortPipeline: true
```

---

## 📊 Comparison with Azure AKS Project

### Did We Use the Same Approach for the Azure AKS Project?

**YES** - Both projects follow the same comprehensive documentation pattern:

1. **RUNBOOK.md** with detailed command-by-command instructions ✅
2. **README.md** with architecture overview and tech stack ✅
3. **Inline comments** in all configuration files (Terraform, K8s, CI/CD) ✅
4. **Pre-deployment checklist** (this file) for required changes ✅
5. **Validation steps** after each major action ✅

### Key Differences Between Projects:

| Aspect | AWS EKS Project (This) | Azure AKS Project |
|--------|------------------------|-------------------|
| **Cloud Provider** | AWS | Azure |
| **Kubernetes** | Amazon EKS | Azure AKS |
| **Container Registry** | Amazon ECR | Azure Container Registry (ACR) |
| **CI/CD Tool** | Jenkins CI + ArgoCD | Azure DevOps Pipelines |
| **IaC Configuration** | Terraform with AWS provider | Terraform with AzureRM provider |
| **Authentication** | AWS CLI + IAM | Azure CLI + Service Principal |
| **Networking** | VPC + Subnets + Security Groups | VNet + Subnets + NSG |
| **Monitoring** | Prometheus + Grafana | Azure Monitor + Application Insights (or Prometheus/Grafana) |
| **DevSecOps** | SonarQube + Trivy | SonarQube + Trivy (same) |
| **GitOps** | ArgoCD | ArgoCD (or Flux) |
| **Load Balancing** | AWS ELB/ALB | Azure Load Balancer |
| **DNS/Ingress** | Route53 + NGINX Ingress | Azure DNS + NGINX Ingress |
| **Secrets Management** | AWS Secrets Manager | Azure Key Vault |

### Consistency Across Both Projects:

Both projects maintain these standards:

✅ **Comprehensive RUNBOOK** with "WHAT/WHERE/WHEN/WHY/EXPECTED OUTPUT" comments  
✅ **Pre-deployment checklist** with exact values to change before deployment  
✅ **Step-by-step validation** commands with expected results  
✅ **Troubleshooting section** for common errors and fixes  
✅ **Clear placeholder identification** (YOUR_*, CHANGE_ME, etc.)  
✅ **Architecture diagrams** showing component relationships  
✅ **Complete end-to-end workflow** from code commit to production deployment  
✅ **Security best practices** (least privilege, secrets management, vulnerability scanning)  
✅ **Monitoring and observability** setup with dashboards and alerts  
✅ **Infrastructure as Code** for reproducible environments  

### Documentation Structure (Same Pattern):

```
📁 Project Root
├── README.md                     # Architecture, features, quick start
├── RUNBOOK.md                    # Step-by-step deployment guide
├── DEPLOYMENT_CHECKLIST.md       # Pre-deployment changes (this file)
├── infra/terraform/              # IaC with inline comments
├── deploy/k8s/                   # K8s manifests with comments
├── cicd/                         # CI/CD configs with detailed notes
├── gitops/                       # GitOps application definitions
└── monitoring/                   # Observability stack configs
```

**To verify consistency:** Both projects should have similar file structures and documentation depth. Check the Azure AKS project for RUNBOOK.md and DEPLOYMENT_CHECKLIST.md files.

---

## 🎯 Quick Reference: All Values to Replace

| Placeholder | Example Value | Where to Change |
|-------------|---------------|------------------|
| `YOUR_AWS_REGION` | `us-west-2` | `infra/terraform/variables.tf`, `cicd/jenkins/Jenkinsfile` |
| `YOUR_EKS_CLUSTER_NAME` | `devops-showcase-eks` | `infra/terraform/variables.tf`, `cicd/jenkins/Jenkinsfile` |
| `YOUR_ECR_REPO_NAME` | `microservices-demo` | `infra/terraform/variables.tf`, `cicd/jenkins/Jenkinsfile` |
| `YOUR_AWS_ACCOUNT_ID` | `123456789012` | `deploy/k8s/*/deployment.yaml`, `cicd/jenkins/Jenkinsfile` |
| `YOUR_GITHUB_USERNAME` | `Noxsup` | `gitops/argocd/apps/*.yaml` |
| `YOUR_NAMESPACE` | `production` | `gitops/argocd/apps/*.yaml`, `deploy/k8s/*/deployment.yaml` |
| `YOUR_DOMAIN.com` | `yourdomain.com` | `monitoring/grafana/values.yaml`, ingress configs |
| `YOUR_SONARQUBE_URL` | `http://sonarqube.local:9000` | `cicd/jenkins/Jenkinsfile` |
| `CHANGE_ME` (passwords) | `SecureP@ssw0rd!` | `monitoring/grafana/values.yaml` |

---

## 📝 Post-Deployment Notes

After successful deployment:

1. **Document actual values** securely:
   - AWS Account ID, Region, Cluster name
   - ECR repository URLs
   - Jenkins, ArgoCD, Grafana URLs and credentials
   - SonarQube token
   - Store in: AWS Secrets Manager, 1Password, LastPass

2. **Enable monitoring and alerting:**
   - CloudWatch for AWS resources
   - Prometheus alerts for cluster health
   - Grafana notifications (Slack, email)

3. **Set up backup strategies:**
   - Terraform state backup (S3 versioning enabled)
   - EKS cluster backup (Velero)
   - Application database backups

4. **Cost optimization:**
   - Enable AWS Cost Explorer
   - Set up billing alerts
   - Consider Spot instances for non-prod workloads
   - Review and optimize instance types

5. **Security hardening:**
   - Enable AWS GuardDuty
   - Configure AWS Config rules
   - Implement network policies in K8s
   - Regular vulnerability scans with Trivy
   - Rotate credentials regularly

6. **Disaster recovery plan:**
   - Document RTO/RPO requirements
   - Test cluster recovery procedures
   - Multi-region setup (if needed)

---

## 🔒 Security Considerations

- [ ] Never commit `terraform.tfvars` with sensitive data to Git
- [ ] Add `terraform.tfvars`, `*.pem`, `*.key` to `.gitignore`
- [ ] Use AWS Secrets Manager for application secrets
- [ ] Enable EKS encryption at rest and in transit
- [ ] Implement Kubernetes RBAC with least privilege
- [ ] Scan Docker images with Trivy before deployment
- [ ] Use AWS IAM roles for service accounts (IRSA)
- [ ] Enable EKS audit logging to CloudWatch
- [ ] Implement network policies to restrict pod communication
- [ ] Use AWS WAF for public-facing services
- [ ] Rotate AWS access keys every 90 days
- [ ] Enable MFA for AWS root and IAM admin accounts
- [ ] Review security group rules regularly

---

## ✨ Success Criteria

You've successfully completed pre-deployment when:

✅ All grep commands show ZERO placeholder values remaining  
✅ `terraform plan` completes without errors  
✅ EKS cluster is accessible via kubectl  
✅ Docker images build and push to ECR successfully  
✅ All Kubernetes pods are Running  
✅ Services have external endpoints and respond to requests  
✅ Jenkins pipeline runs end-to-end successfully  
✅ ArgoCD applications are synced and healthy  
✅ Prometheus scrapes metrics from all targets  
✅ Grafana dashboards display real-time data  
✅ SonarQube quality gate passes  
✅ Trivy security scan shows acceptable vulnerabilities  
✅ All validation checklists are checked ✓  

---

**Last Updated:** May 2026  
**Maintainer:** DevOps Team / Noxsup  
**Questions?** Check RUNBOOK.md or raise an issue in the GitHub repository  
**Repository:** https://github.com/Noxsup/devops-cloud-native-showcase
