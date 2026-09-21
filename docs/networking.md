# Networking

Goal: control **who can reach** Postgres and secrets, then give the API a
**private path** to the database (Stage 4).

## Current posture (Stage 4)

```
Internet
  ├─ Browser → Static Web App (public HTTPS)
  ├─ Browser → App Service API (public HTTPS + Entra JWT)
  └─ Your laptop → Postgres :5432 / Key Vault  only if your IP is allow-listed

VNet (West Europe — same region as App Service)
  ├─ snet-app          ← App Service VNet integration (B1)
  └─ snet-pe           ← Private Endpoint NIC for Postgres

App Service (via VNet)
  ├─ Postgres          ← Private Endpoint + private DNS (not public IP allow-list)
  └─ Key Vault         ← MI + RBAC; network bypass = AzureServices
```

Postgres lives in **UK South**; the Private Endpoint sits in the **West Europe** VNet.
Traffic uses Azure Private Link (not the public internet). Slight cross-region
latency is fine for learning.

### Stage 3 (still true)
- Postgres firewall: **your client IP** only (for laptop `psql`)
- Key Vault: Deny + `AzureServices` bypass + your IP
- TLS required on Postgres

### Stage 4 (new)
| Piece | Why |
|-------|-----|
| VNet + two subnets | Private roads for app + endpoints |
| App Service **B1** | F1 cannot join a VNet |
| VNet integration + `vnet_route_all_enabled` | API outbound goes via the VNet |
| Private Endpoint + `privatelink.postgres.database.azure.com` | DB reachable on a private IP from the VNet |
| App Insights | Basic telemetry resource (wire SDK later if you want rich traces) |

**Not done yet (optional later):** disable Postgres `public_network_access` entirely
(needs VPN/jump box for laptop access).

## Cost (ballpark)
- B1 App Service: ~£35–45/month
- Private Endpoint: ~£5–8/month
- App Insights: usually free at this volume
- Tear down PE + drop to F1 when you want to save money

## Ops: update your home IP

```bash
curl -s https://api.ipify.org; echo
cd infra
terraform apply -var="postgres_client_ip=YOUR_IP"
```

## Apply
```bash
cd infra
terraform plan
terraform apply
```
