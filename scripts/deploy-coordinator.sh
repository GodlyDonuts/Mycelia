#!/usr/bin/env bash
# Deploy Mycelia training coordinator to ECS Fargate (roadmap script)
set -euo pipefail

ENV="${1:-staging}"
REGION="${AWS_REGION:-us-east-1}"

echo "==> Mycelia coordinator deploy env=$ENV region=$REGION"

cd "$(dirname "$0")/../.."

echo "==> Building frontend..."
cd frontend && pnpm install && pnpm build

echo "==> Terraform plan (infra/terraform/multi-region)..."
cd ../infra/terraform/multi-region
terraform init -backend=false 2>/dev/null || true
terraform plan -var="environment=$ENV" -out=tfplan 2>/dev/null || echo "(terraform stub — no AWS creds)"

echo "==> Would push container to ECR and update ECS service"
echo "    Image: mycelia/coordinator:$ENV"
echo "    Cluster: mycelia-coordinator-$ENV"
echo "Done (dry-run)."
