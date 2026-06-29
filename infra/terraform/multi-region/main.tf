module "dsql" {
  source = "../dsql"

  environment     = "production"
  primary_region  = "us-east-1"
  replica_regions = ["us-west-2", "eu-west-1", "ap-southeast-1"]
}

module "turn_us_east" {
  source = "../turn"

  region      = "us-east-1"
  environment = "production"
  task_count  = 3
}

module "turn_eu_west" {
  source = "../turn"

  region      = "eu-west-1"
  environment = "production"
  task_count  = 2
}

output "coordinator_url" {
  value = "https://coordinator.mycelia.dev"
}

output "turn_uris" {
  value = [
    "turn:turn-us-east.mycelia.internal:3478",
    "turn:turn-eu-west.mycelia.internal:3478",
  ]
}
