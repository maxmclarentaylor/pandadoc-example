output "resource_group_name" {
  value = azurerm_resource_group.dev.name
}

output "key_vault_name" {
  value = azurerm_key_vault.dev.name
}

output "key_vault_uri" {
  value = azurerm_key_vault.dev.vault_uri
}

output "location" {
  value = azurerm_resource_group.dev.location
}

output "postgres_server_name" {
  value = azurerm_postgresql_flexible_server.dev.name
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.dev.fqdn
}

output "postgres_database_name" {
  value = azurerm_postgresql_flexible_server_database.app.name
}

output "postgres_admin_login" {
  value = var.postgres_admin_login
}
