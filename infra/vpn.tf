# Stage 5 — Point-to-Site VPN into the VNet
# Lets your laptop reach Private Endpoints (Postgres / Key Vault) over a private tunnel.
# Opt-in: -var="enable_vpn_gateway=true" (VpnGw1 ≈ £25–35/mo; create can take 30–45 min).
# After VPN works, set postgres_public_network_access=false to close the public DB path.

resource "azurerm_subnet" "gateway" {
  count = var.enable_vpn_gateway ? 1 : 0

  # Name must be exactly GatewaySubnet (Azure requirement).
  name                 = "GatewaySubnet"
  resource_group_name  = azurerm_resource_group.dev.name
  virtual_network_name = azurerm_virtual_network.dev.name
  address_prefixes     = ["10.10.3.0/27"]
}

resource "azurerm_public_ip" "vpn" {
  count = var.enable_vpn_gateway ? 1 : 0

  name                = "pip-vpn-${random_string.suffix.result}"
  location            = azurerm_virtual_network.dev.location
  resource_group_name = azurerm_resource_group.dev.name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = local.common_tags
}

# Root CA + client cert (generated in Terraform; install client cert on your Mac).
resource "tls_private_key" "vpn_ca" {
  count = var.enable_vpn_gateway ? 1 : 0

  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "vpn_ca" {
  count = var.enable_vpn_gateway ? 1 : 0

  private_key_pem = tls_private_key.vpn_ca[0].private_key_pem

  subject {
    common_name  = "segment-practice-vpn-root"
    organization = "segment-practice"
  }

  validity_period_hours = 87600 # ~10 years
  is_ca_certificate     = true

  allowed_uses = [
    "cert_signing",
    "crl_signing",
  ]
}

resource "tls_private_key" "vpn_client" {
  count = var.enable_vpn_gateway ? 1 : 0

  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_cert_request" "vpn_client" {
  count = var.enable_vpn_gateway ? 1 : 0

  private_key_pem = tls_private_key.vpn_client[0].private_key_pem

  subject {
    common_name  = "segment-practice-vpn-client"
    organization = "segment-practice"
  }
}

resource "tls_locally_signed_cert" "vpn_client" {
  count = var.enable_vpn_gateway ? 1 : 0

  cert_request_pem   = tls_cert_request.vpn_client[0].cert_request_pem
  ca_private_key_pem = tls_private_key.vpn_ca[0].private_key_pem
  ca_cert_pem        = tls_self_signed_cert.vpn_ca[0].cert_pem

  validity_period_hours = 8760 # 1 year

  allowed_uses = [
    "client_auth",
    "digital_signature",
    "key_encipherment",
  ]
}

resource "azurerm_virtual_network_gateway" "vpn" {
  count = var.enable_vpn_gateway ? 1 : 0

  name                = "vpngw-${random_string.suffix.result}"
  location            = azurerm_virtual_network.dev.location
  resource_group_name = azurerm_resource_group.dev.name
  type                = "Vpn"
  vpn_type            = "RouteBased"
  sku                 = "VpnGw1"
  active_active       = false
  enable_bgp          = false
  tags                = local.common_tags

  ip_configuration {
    name                          = "vnetGatewayConfig"
    public_ip_address_id          = azurerm_public_ip.vpn[0].id
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = azurerm_subnet.gateway[0].id
  }

  vpn_client_configuration {
    address_space        = ["172.16.250.0/24"]
    vpn_client_protocols = ["OpenVPN", "IkeV2"]
    vpn_auth_types       = ["Certificate"]

    # Azure wants base64 DER of the root cert (PEM body without headers).
    root_certificate {
      name = "segment-practice-vpn-root"
      public_cert_data = trimspace(
        replace(
          replace(tls_self_signed_cert.vpn_ca[0].cert_pem, "-----BEGIN CERTIFICATE-----", ""),
          "-----END CERTIFICATE-----",
          "",
        )
      )
    }
  }
}
