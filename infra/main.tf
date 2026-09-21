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
  # Still a public endpoint, but firewall restricts who can call it.
  public_network_access_enabled = true
  tags                          = local.common_tags

  # Stage 3b: deny by default; allow your IP + trusted Azure services (App Service MI → secrets).
  # GitHub Actions runners are NOT Azure services — remote Terraform that writes secrets will fail
  # unless you apply from an allow-listed IP (or temporarily open the vault). See docs/networking.md.
  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    ip_rules       = [var.postgres_client_ip]
    # App Service VNet integration subnet (Stage 4)
    virtual_network_subnet_ids = [azurerm_subnet.app.id]
  }
}

# So you can manage secrets in the portal / CLI after apply
resource "azurerm_role_assignment" "current_user_kv_admin" {
  scope                = azurerm_key_vault.dev.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}
