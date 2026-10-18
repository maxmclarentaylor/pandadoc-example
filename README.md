# segment-practice

Personal replica of Segment (event ingest/routing) + Mixpanel (storage/analytics).

**Stack:** Azure · Python · SQL · React · Terraform · Azure DevOps (pipelines) · GitHub (source)

**Environment:** `dev` only for now · Region: UK South

## Layout
- `docs/` — architecture, bootstrap, CI/CD
- `infra/` — Terraform (Azure RG, Key Vault, Postgres, App Service, Static Web Apps)
- `apps/api/` — Python FastAPI (`/v1/track`, `/v1/events`)
- `apps/web/` — React event console
- `.github/workflows/` — GitHub Actions → Azure
- `docker-compose.yml` — local API + Postgres (Python 3.12, closer to App Service)

## Local run
```bash
# API (venv)
cd apps/api && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# API (Docker — Python 3.12 + local Postgres)
cp apps/api/.env.docker.example apps/api/.env.docker
docker compose up --build
docker compose run --rm api alembic upgrade head

# UI (separate terminal; still on the host)
cd apps/web && npm run dev
```

Deploy to Azure: see `docs/cicd.md`.
