# segment-practice

Personal replica of Segment (event ingest/routing) + Mixpanel (storage/analytics).

**Stack:** Azure · Python · SQL · React · Terraform · Azure DevOps (pipelines) · GitHub (source)

**Environment:** `dev` only for now · Region: UK South

## Layout
- `docs/` — architecture and bootstrap notes
- `infra/` — Terraform (Azure RG, Key Vault, Postgres)
- `apps/api/` — Python FastAPI (`/v1/track`, `/v1/events`)
- `apps/web/` — React event console

## Local run
```bash
# API
cd apps/api && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# UI (separate terminal)
cd apps/web && npm run dev
```
