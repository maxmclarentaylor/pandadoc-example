# API (v0)

Thin Segment-like ingest + Mixpanel-like recent-event read against Azure Postgres.

## Endpoints
- `GET /health`
- `POST /v1/track` — write one event (`message_id` is idempotent)
- `GET /v1/events?limit=20` — recent events

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

curl -s -X POST http://localhost:8000/v1/track \
  -H 'Content-Type: application/json' \
  -d '{
    "message_id": "msg_001",
    "user_id": "user_123",
    "event": "Page Viewed",
    "properties": {"path": "/pricing"}
  }'

curl -s http://localhost:8000/v1/events | python3 -m json.tool
```
