# API (v0)

Thin Segment-like ingest + Mixpanel-like recent-event read against Azure Postgres.

## Endpoints
- `GET /health`
- `POST /v1/track` — write one event (`message_id` is idempotent)
- `GET /v1/events?limit=20` — recent events
- `POST /v1/identify` — upsert user traits (merge on `user_id`)
- `GET /v1/profiles?limit=20` — recent profiles

## Layout
- `app/schemas.py` — Pydantic request/response models
- `app/orm.py` — SQLAlchemy table classes (`Event`, `Profile`)
- `app/crud.py` — DB operations used by routes
- `app/db.py` — engine, `get_db` session dependency, `init_db`

## Setup
```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Pull connection string from Key Vault into .env
az keyvault secret show \
  --vault-name segpracticedevkvr5bq \
  --name postgres-connection-string \
  --query value -o tsv | awk '{print "DATABASE_URL="$0}' > .env

uvicorn app.main:app --reload --port 8000
```

## Try it
```bash
curl -s http://localhost:8000/health
```
(Authenticated `/v1/*` routes need a Bearer Entra access token.)
