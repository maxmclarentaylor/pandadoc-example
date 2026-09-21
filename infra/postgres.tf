# Azure Database for PostgreSQL Flexible Server (dev)
# - Managed Postgres (not a VM you patch)
# - Stage 4: App Service → Postgres via Private Endpoint (see networking.tf)
# - Public access kept for laptop tooling (client IP firewall only)
# See docs/networking.md

resource "random_password" "postgres_admin" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:"
}

resource "azurerm_postgresql_flexible_server" "dev" {
  name                   = "segpractice-pg-${random_string.suffix.result}"
  resource_group_name    = azurerm_resource_group.dev.name
  location               = azurerm_resource_group.dev.location
  version                = var.postgres_version
  administrator_login    = var.postgres_admin_login
  administrator_password = random_password.postgres_admin.result

  sku_name   = var.postgres_sku_name
  storage_mb = var.postgres_storage_mb
  zone       = "1"

  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  public_network_access_enabled = true

  authentication {
    password_auth_enabled         = true
    active_directory_auth_enabled = false
  }

  tags = local.common_tags

  # Password is also in Key Vault; avoid forcing replace on later churn
  lifecycle {
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "segment"
  server_id = azurerm_postgresql_flexible_server.dev.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# TLS required for client connections (explicit; Azure default is already on)
resource "azurerm_postgresql_flexible_server_configuration" "require_secure_transport" {
  name      = "require_secure_transport"
  server_id = azurerm_postgresql_flexible_server.dev.id
  value     = "on"
}

# Laptop / local tooling only. App Service uses Private Endpoint (not this rule).
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_client" {
  name             = "AllowClientDev"
  server_id        = azurerm_postgresql_flexible_server.dev.id
  start_ip_address = var.postgres_client_ip
  end_ip_address   = var.postgres_client_ip
}

resource "azurerm_key_vault_secret" "postgres_admin_password" {
  name         = "postgres-admin-password"
  value        = random_password.postgres_admin.result
  key_vault_id = azurerm_key_vault.dev.id

  depends_on = [azurerm_role_assignment.current_user_kv_admin]
}

resource "azurerm_key_vault_secret" "postgres_fqdn" {
  name         = "postgres-fqdn"
  value        = azurerm_postgresql_flexible_server.dev.fqdn
  key_vault_id = azurerm_key_vault.dev.id

  depends_on = [azurerm_role_assignment.current_user_kv_admin]
}

resource "azurerm_key_vault_secret" "postgres_connection_string" {
  name = "postgres-connection-string"
  value = format(
    "postgresql://%s:%s@%s:5432/%s?sslmode=require",
    var.postgres_admin_login,
    random_password.postgres_admin.result,
    azurerm_postgresql_flexible_server.dev.fqdn,
    azurerm_postgresql_flexible_server_database.app.name
  )
  key_vault_id = azurerm_key_vault.dev.id

  depends_on = [azurerm_role_assignment.current_user_kv_admin]
}
