variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "task_count" {
  type    = number
  default = 2
}

resource "aws_ecs_service" "coturn" {
  name            = "mycelia-coturn-${var.region}"
  cluster         = "mycelia-turn-${var.environment}"
  desired_count   = var.task_count
  launch_type     = "FARGATE"

  # task_definition = aws_ecs_task_definition.coturn.arn
}

resource "aws_lb" "turn" {
  name               = "mycelia-turn-${var.region}"
  internal           = false
  load_balancer_type = "network"
}

output "turn_endpoint" {
  value = "turn:turn-${var.region}.mycelia.internal:3478"
}
