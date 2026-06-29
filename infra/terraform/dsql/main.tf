# Aurora DSQL cluster — primary coordinator datastore (roadmap)
# Swap target for frontend/lib/db/index.ts

variable "environment" {
  type    = string
  default = "staging"
}

variable "primary_region" {
  type    = string
  default = "us-east-1"
}

variable "replica_regions" {
  type    = list(string)
  default = ["us-west-2", "eu-west-1"]
}

resource "aws_dsql_cluster" "mycelia_coordinator" {
  # placeholder — Aurora DSQL not GA in all accounts
  cluster_identifier = "mycelia-coordinator-${var.environment}"
  region             = var.primary_region

  lifecycle {
    prevent_destroy = false
  }
}

resource "aws_s3_bucket" "checkpoints" {
  bucket = "mycelia-checkpoints-${var.environment}"
}

resource "aws_s3_bucket" "datasets" {
  bucket = "mycelia-datasets-${var.environment}"
}

resource "aws_ecs_cluster" "turn_relay" {
  name = "mycelia-turn-${var.environment}"
}

output "dsql_endpoint" {
  value = "dsql://${var.primary_region}.mycelia.internal:5432/coordinator"
}

output "checkpoint_bucket" {
  value = aws_s3_bucket.checkpoints.bucket
}
