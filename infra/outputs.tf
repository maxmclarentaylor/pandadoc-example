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

output "api_webapp_name" {
  value = azurerm_linux_web_app.api.name
}

output "api_default_hostname" {
  value = azurerm_linux_web_app.api.default_hostname
}

output "web_static_app_name" {
  value = azurerm_static_web_app.web.name
}

output "web_default_hostname" {
  value = azurerm_static_web_app.web.default_host_name
}

output "web_api_token" {
  value     = azurerm_static_web_app.web.api_key
  sensitive = true
}

output "vnet_name" {
  value = azurerm_virtual_network.dev.name
}

output "app_insights_name" {
  value = azurerm_application_insights.api.name
}

output "postgres_private_endpoint_name" {
  value = azurerm_private_endpoint.postgres.name
}
