# API host (Linux App Service) + frontend (Static Web Apps)
# Stage 4: B1 + VNet integration so the API reaches Postgres via Private Endpoint.

resource "azurerm_service_plan" "api" {
  name                = "segpractice-plan-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.dev.name
  # Same region as VNet (VNet integration must be regional).
  location = "westeurope"
  os_type  = "Linux"
  # B1 required for VNet integration (F1 cannot join a VNet).
  sku_name = "B1"
  tags     = local.common_tags
}

resource "azurerm_linux_web_app" "api" {
  name                      = "segpractice-api-${random_string.suffix.result}"
  resource_group_name       = azurerm_resource_group.dev.name
  location                  = azurerm_service_plan.api.location
  service_plan_id           = azurerm_service_plan.api.id
  https_only                = true
  virtual_network_subnet_id = azurerm_subnet.app.id
  tags                      = local.common_tags

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on              = true # allowed on B1
    ftps_state             = "Disabled"
    minimum_tls_version    = "1.2"
    vnet_route_all_enabled = true # send outbound (incl. Private Endpoint) via VNet

    application_stack {
      python_version = "3.12"
    }

    app_command_line = "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
    cors {
      allowed_origins = compact([
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        try(format("https://%s", azurerm_static_web_app.web.default_host_name), null),
      ])
      support_credentials = true
    }
  }

  app_settings = {
    WEBSITES_PORT                     = "8000"
    SCM_DO_BUILD_DURING_DEPLOYMENT    = "true"
    DATABASE_URL                      = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault.dev.vault_uri}secrets/postgres-connection-string/)"
    AZURE_TENANT_ID                   = var.entra_tenant_id
    AZURE_API_CLIENT_ID               = var.entra_api_client_id
    AZURE_API_AUDIENCE                = "api://${var.entra_api_client_id}"
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.api.connection_string
    ALLOWED_ORIGINS = join(",", compact([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      try(format("https://%s", azurerm_static_web_app.web.default_host_name), null),
    ]))
  }
}

resource "azurerm_role_assignment" "api_kv_secrets_user" {
  scope                = azurerm_key_vault.dev.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.api.identity[0].principal_id
}

resource "azurerm_static_web_app" "web" {
  name                = "segpractice-web-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.dev.name
  location            = "westeurope" # Static Web Apps not in every region; WE is fine for UK users
  sku_tier            = "Free"
  sku_size            = "Free"
  tags                = local.common_tags

  # GitHub connection is often set in portal / SWA token deploy — don't wipe it on apply.
  lifecycle {
    ignore_changes = [
      repository_url,
      repository_branch,
    ]
  }
}
