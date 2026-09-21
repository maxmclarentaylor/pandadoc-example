# Ops runbook (dev)

Personal Azure ops notes for `segment-practice`.

## Smoke URLs
- API health: https://segpractice-api-r5bq.azurewebsites.net/health
- UI: https://red-island-0d916eb03.5.azurestaticapps.net

## What costs money
| Resource | Notes |
|----------|--------|
| Postgres Flexible Server `segpractice-pg-r5bq` | Main cost while **Running**. Stop when idle. |
| App Service Free F1 | Limited free tier; may cold-start. |
| Static Web Apps Free | Free tier for this project. |
| Key Vault / tfstate storage | Negligible at this scale. |

## Postgres start / stop
```bash
# Stop (save compute cost)
az postgres flexible-server stop \
  -g segment-practice-dev-rg \
  -n segpractice-pg-r5bq

# Start (before using API track/list)
az postgres flexible-server start \
  -g segment-practice-dev-rg \
  -n segpractice-pg-r5bq
```

Azure may auto-start a stopped flexible server after **7 days** if you do not start it yourself.

After start, wait ~1–2 minutes, then hit `/health`.

## Deploy
- GitHub Actions → **Deploy API** / **Deploy Web** (environment `dev`)
- Docs for secrets/OIDC: `docs/cicd.md`

## Alerts / budget
- Subscription budget + email alerts (Cost Management)
- Monitor action group + App Service HTTP 5xx alert (see Stage 1 setup)

## Auth (Stage 2)
Entra ID JWTs on `/v1/me`, `/v1/track`, `/v1/events` (`/health` public).
See `docs/auth.md` for portal setup and the token flow.
- App Service still uses **managed identity** → Key Vault for `DATABASE_URL`

## Networking (Stage 3–4)
- **Postgres:** App Service via **Private Endpoint** (VNet); laptop via public firewall (your IP). TLS required.
- **Key Vault:** Deny by default; `AzureServices` bypass + your IP. Apply Terraform from that IP.
- **App Service:** **B1** + VNet integration (~£40/mo) — required for private DB path.
See `docs/networking.md`.

## GitHub Actions identity (RBAC)
The Actions service principal is scoped to this project:
- Contributor + User Access Administrator on `segment-practice-dev-rg`
- Storage Blob Data Contributor on tfstate storage (`segpracttfstatee6d6b7`)
It no longer has subscription-wide Contributor.
