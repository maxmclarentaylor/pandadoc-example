# Networking

Goal: control **who can reach** Postgres and secrets, then give the API a
**private path** to both (Stage 4 / 4b).

## Current posture (Stage 4b)

```
Internet
  ├─ Browser → Static Web App (public HTTPS)
  ├─ Browser → App Service API (public HTTPS + Entra JWT)
  └─ Your laptop → Postgres :5432 / Key Vault  only if your IP is allow-listed

VNet (West Europe — same region as App Service)
  ├─ snet-app          ← App Service VNet integration (B1)
  └─ snet-pe           ← Private Endpoint NICs (Postgres + Key Vault)

App Service (via VNet)
  ├─ Postgres          ← Private Endpoint + privatelink.postgres.database.azure.com
  └─ Key Vault         ← Private Endpoint + privatelink.vaultcore.azure.net
                         (MI + RBAC still required; PE is the network path)
```

Postgres lives in **UK South**; Private Endpoints sit in the **West Europe** VNet.
Traffic uses Azure Private Link (not the public internet).

### Stage 3 (still true)
- Postgres firewall: **your client IP** only (for laptop `psql`)
- Key Vault: Deny + `AzureServices` bypass + your IP (for laptop Terraform/portal)
- TLS required on Postgres

### Stage 4 / 4b
| Piece | Why |
|-------|-----|
| VNet + two subnets | Private roads for app + endpoints |
| App Service **B1** | F1 cannot join a VNet |
| VNet integration + route-all | API outbound goes via the VNet |
| Postgres Private Endpoint + private DNS | DB on a private IP from the VNet |
| **Key Vault Private Endpoint + private DNS** | Secrets on a private IP from the VNet (Stage 4b) |
| App Insights | Request telemetry (SDK wired in the API) |

**Not done yet (optional later):** disable Postgres / Key Vault `public_network_access` entirely
(needs VPN/jump box for laptop access).

## Cost (ballpark)
- B1 App Service: ~£35–45/month
- Private Endpoint: ~£5–8/month **each** (Postgres + Key Vault ≈ £10–16)
- App Insights: usually free at this volume
- Tear down PEs + drop to F1 when you want to save money

## Ops: update your home IP

```bash
curl -s https://api.ipify.org; echo
cd infra
terraform apply -var="postgres_client_ip=YOUR_IP"
```

## Apply Stage 4b (Key Vault PE)

```bash
cd infra
terraform plan
terraform apply
```

Then smoke: SWA sign-in → track / identify (proves App → PE → Key Vault → PE → Postgres).
