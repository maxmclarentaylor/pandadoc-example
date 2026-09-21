# Stage 4 — private path for App Service → Postgres
# VNet in West Europe (same region as App Service). Postgres stays in UK South;
# Private Link carries traffic over the Azure backbone.
# Laptop access: public Postgres firewall (client IP) still allowed for local tools.

resource "azurerm_virtual_network" "dev" {
  name                = "segpractice-vnet-${random_string.suffix.result}"
  location            = azurerm_service_plan.api.location
  resource_group_name = azurerm_resource_group.dev.name
  address_space       = ["10.10.0.0/16"]
  tags                = local.common_tags
}

# App Service VNet integration (must be delegated to Microsoft.Web/serverFarms)
resource "azurerm_subnet" "app" {
  name                 = "snet-app"
  resource_group_name  = azurerm_resource_group.dev.name
  virtual_network_name = azurerm_virtual_network.dev.name
  address_prefixes     = ["10.10.1.0/24"]
  # So App Service (VNet-integrated) can still reach Key Vault under Deny ACLs
  service_endpoints = ["Microsoft.KeyVault"]

  delegation {
    name = "app-service-delegation"

    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

# Private Endpoints subnet (no delegation)
resource "azurerm_subnet" "private_endpoints" {
  name                              = "snet-pe"
  resource_group_name               = azurerm_resource_group.dev.name
  virtual_network_name              = azurerm_virtual_network.dev.name
  address_prefixes                  = ["10.10.2.0/24"]
  private_endpoint_network_policies = "Disabled"
}

# Private DNS so FQDN resolves to the private IP inside the VNet
resource "azurerm_private_dns_zone" "postgres" {
  name                = "privatelink.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.dev.name
  tags                = local.common_tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "link-postgres-dns"
  resource_group_name   = azurerm_resource_group.dev.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = azurerm_virtual_network.dev.id
  registration_enabled  = false
  tags                  = local.common_tags
}

resource "azurerm_private_endpoint" "postgres" {
  name                = "pe-postgres-${random_string.suffix.result}"
  location            = azurerm_virtual_network.dev.location
  resource_group_name = azurerm_resource_group.dev.name
  subnet_id           = azurerm_subnet.private_endpoints.id
  tags                = local.common_tags

  private_service_connection {
    name                           = "psc-postgres"
    private_connection_resource_id = azurerm_postgresql_flexible_server.dev.id
    is_manual_connection           = false
    subresource_names              = ["postgresqlServer"]
  }

  private_dns_zone_group {
    name                 = "postgres-dns-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.postgres.id]
  }
}

# App Insights (workspace-based; free tier is enough at this scale)
resource "azurerm_log_analytics_workspace" "api" {
  name                = "segpractice-law-${random_string.suffix.result}"
  location            = azurerm_service_plan.api.location
  resource_group_name = azurerm_resource_group.dev.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.common_tags
}

resource "azurerm_application_insights" "api" {
  name                = "segpractice-appi-${random_string.suffix.result}"
  location            = azurerm_service_plan.api.location
  resource_group_name = azurerm_resource_group.dev.name
  workspace_id        = azurerm_log_analytics_workspace.api.id
  application_type    = "web"
  tags                = local.common_tags
}
