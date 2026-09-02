# API host (Linux App Service) + frontend (Static Web Apps)
# Managed hosts — still not VMs.

resource "azurerm_service_plan" "api" {
  name                = "segpractice-plan-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.dev.name
  # App Service compute quota is regional; UK South may be 0 on new subs.
  location = "westeurope"
  os_type  = "Linux"
  # F1 avoids paid-plan VM quota issues on new/personal subscriptions.
  # Upgrade to B1 later after a quota increase if you need Always On.
  sku_name = "F1"
  tags     = local.common_tags
}

resource "azurerm_linux_web_app" "api" {
  name                = "segpractice-api-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_service_plan.api.location
  service_plan_id     = azurerm_service_plan.api.id
  https_only          = true
  tags                = local.common_tags

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on           = false # required for F1
    ftps_state          = "Disabled"
    minimum_tls_version = "1.2"

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
    WEBSITES_PORT                  = "8000"
    SCM_DO_BUILD_DURING_DEPLOYMENT = "true"
    DATABASE_URL                   = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault.dev.vault_uri}secrets/postgres-connection-string/)"
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
}
