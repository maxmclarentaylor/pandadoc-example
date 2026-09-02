locals {
  name_prefix = "${var.project}-${var.environment}"
  # Key Vault: 3-24 chars, alphanumeric only
  key_vault_name = "segpracticedevkv${random_string.suffix.result}"
  common_tags = {
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "random_string" "suffix" {
  length  = 4
  upper   = false
  special = false
}

resource "azurerm_resource_group" "dev" {
  name     = "${local.name_prefix}-rg"
  location = var.location
  tags     = local.common_tags
}

resource "azurerm_key_vault" "dev" {
  name                       = local.key_vault_name
  location                   = azurerm_resource_group.dev.location
  resource_group_name        = azurerm_resource_group.dev.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = false
  rbac_authorization_enabled = true
  tags                       = local.common_tags
}

# So you can manage secrets in the portal / CLI after apply
resource "azurerm_role_assignment" "current_user_kv_admin" {
  scope                = azurerm_key_vault.dev.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}
