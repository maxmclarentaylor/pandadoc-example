# Networking

Goal: control **who can reach** Postgres and secrets, then give the API a
**private path** to both (Stage 4 / 4b). Stage 5 adds a VPN so *your laptop*
can use that private path too — then public DB access can be turned off.

## Current posture

```
Internet
  ├─ Browser → Static Web App (public HTTPS)
  ├─ Browser → App Service API (public HTTPS + Entra JWT)
  └─ Your laptop
       ├─ (today) public Postgres / Key Vault if IP allow-listed
       └─ (Stage 5) VPN → VNet → Private Endpoints

VNet (West Europe — same region as App Service)
  ├─ snet-app          ← App Service VNet integration (B1)
  ├─ snet-pe           ← Private Endpoint NICs (Postgres + Key Vault)
  └─ GatewaySubnet     ← VPN Gateway (Stage 5, opt-in)

App Service (via VNet)
  ├─ Postgres          ← Private Endpoint + private DNS
  └─ Key Vault         ← Private Endpoint + private DNS
```

### Stage 4 / 4b (done in Terraform)
| Piece | Why |
|-------|-----|
| VNet + app/pe subnets | Private roads |
| App Service **B1** + VNet integration | API can use Private Endpoints |
| Postgres + Key Vault Private Endpoints | Private IPs for DB and secrets |
| App Insights | Request telemetry |

### Stage 5 (VPN → then close public Postgres)
| Piece | Why |
|-------|-----|
| VPN Gateway (VpnGw1AZ) + Point-to-Site | Laptop joins the VNet over a tunnel |
| Cert-based auth (root + client cert) | No shared password; install client cert on your Mac |
| `postgres_public_network_access=false` | After VPN works — DB has **no** public endpoint |

## Cost (ballpark)
- B1 App Service: ~£35–45/month
- Private Endpoint: ~£5–8/month **each** (×2)
- **VPN Gateway VpnGw1AZ: ~£25–40/month** (only if `enable_vpn_gateway=true`)
- Tear down VPN / PEs / drop to F1 when you want to save money

## Apply Key Vault PE (Stage 4b) if not already live

```bash
cd infra
terraform plan
terraform apply
```

## Stage 5 — enable VPN (opt-in)

```bash
cd infra
terraform init -upgrade   # picks up hashicorp/tls
terraform apply -var="enable_vpn_gateway=true"
```

Gateway create often takes **30–45 minutes**.

### Install the client certificate (macOS)

```bash
cd infra
mkdir -p .vpn && chmod 700 .vpn
terraform output -raw vpn_ca_cert_pem     > .vpn/ca.crt
terraform output -raw vpn_client_cert_pem > .vpn/client.crt
terraform output -raw vpn_client_key_pem  > .vpn/client.key

openssl pkcs12 -export \
  -out .vpn/client.pfx \
  -inkey .vpn/client.key \
  -in .vpn/client.crt \
  -certfile .vpn/ca.crt
# choose an export password; you'll type it when importing
```

1. Double-click `client.pfx` → add to **login** keychain  
2. Install **Azure VPN Client** from the Mac App Store  
3. Portal → Virtual network gateway → **Point-to-site configuration** → **Download VPN client**  
4. Import the profile into Azure VPN Client → connect  

### After VPN connects — close public Postgres

```bash
terraform apply \
  -var="enable_vpn_gateway=true" \
  -var="postgres_public_network_access=false"
```

App Service keeps working via PE. Your laptop needs the VPN for `psql` / direct DB tools.

### DNS note
Private DNS zones are linked to the VNet. After VPN connect, if hostnames
still resolve to public IPs, look up the PE private IP in the portal and test
with that, or flush DNS / check Azure VPN Client DNS settings.

## Ops: update your home IP (while public access is still on)

```bash
curl -s https://api.ipify.org; echo
cd infra
terraform apply -var="postgres_client_ip=YOUR_IP"
```
