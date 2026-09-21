# Networking (Stage 3)

Goal: understand **who can reach** Postgres and secrets — not build a full private
VNet yet (Free **F1** App Service cannot do VNet integration).

## Current posture (after Stage 3 tighten)

```
Internet
  ├─ Browser → Static Web App (public HTTPS)
  ├─ Browser → App Service API (public HTTPS + Entra JWT)
  └─ Your laptop → Postgres :5432  only if your IP is allow-listed

App Service (outbound IPs)
  └─ Postgres :5432  (explicit firewall rules — not "Allow Azure services")
  └─ Key Vault       (MI + RBAC; still public endpoint for now)
```

### Postgres Flexible Server
- `public_network_access_enabled = true` (needed until Private Endpoint + VNet)
- Firewall:
  - **Your client IP** (`postgres_client_ip`) — local `psql` / tooling
  - **App Service possible outbound IPs** — API → database
- **No** `0.0.0.0` “Allow Azure services” rule (that allowed *any* Azure customer resource in theory)
- `require_secure_transport = on` (TLS required)

### Why not Private Endpoint yet?
| Approach | Pros | Cons for this project |
|----------|------|------------------------|
| Public + firewall (now) | Cheap, works on F1 | DB has a public DNS name |
| Private Endpoint + VNet | No public DB | Needs VNet integration (not on Free F1), more cost/complexity |

Upgrade App Service plan later → then revisit private access.

## Ops: update your home IP

Home ISP IPs change. If local DB tools fail:

```bash
curl -s https://api.ipify.org; echo

# Terraform: set postgres_client_ip in a local tfvars (gitignored) or -var
# Then apply, or update the Azure rule directly:
az postgres flexible-server firewall-rule update \
  -g segment-practice-dev-rg -s segpractice-pg-r5bq \
  -n AllowClientDev \
  --start-ip-address YOUR_IP --end-ip-address YOUR_IP
```

List rules:

```bash
az postgres flexible-server firewall-rule list \
  -g segment-practice-dev-rg -s segpractice-pg-r5bq -o table
```

## Later (Stage 3b / 4)
- Key Vault firewall: `Deny` + `AzureServices` bypass + your IP (careful: GitHub Actions is *not* an Azure service — can break remote Terraform secret writes)
- Private Endpoint for Postgres after leaving F1
- App Insights / diagnostics for network failures
