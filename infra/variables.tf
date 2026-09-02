variable "location" {
  type        = string
  description = "Azure region for dev resources"
  default     = "uksouth"
}

variable "project" {
  type        = string
  description = "Short project name used in resource naming"
  default     = "segment-practice"
}

variable "environment" {
  type        = string
  description = "Environment name"
  default     = "dev"
}
