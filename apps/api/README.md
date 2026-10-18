# API (v0)

Thin Segment-like ingest + Mixpanel-like recent-event read against Azure Postgres.

## Endpoints
- `GET /health`
- `POST /v1/track` — write one event (`message_id` is idempotent); enqueues destination deliveries
- `POST /v1/batch` — many track/identify messages; per-item results (partial success)
- `GET /v1/events?limit=20` — recent events
- `POST /v1/identify` — upsert user traits (merge on `user_id`)
- `POST /v1/identity/merge` — link `anonymous_id` → `user_id` (profile stamp + event backfill)
- `GET /v1/profiles?limit=20` — recent profiles
- `POST /v1/destinations` — register a webhook URL (httpbin / httpstat.us / Slack)
- `GET /v1/destinations` — list destinations
- `PATCH /v1/destinations/{id}/enabled?enabled=true|false`
- `GET /v1/deliveries` — fan-out status (`pending` | `retrying` | `success` | `dead`)
- `GET /v1/deliveries/stats` — queue health (DLQ depth, lag, status counts)
- `POST /v1/deliveries/process` — **worker tick** (attempt due deliveries)
- `POST /v1/deliveries/{id}/replay` — requeue a dead-lettered delivery

## Layout
- `app/schemas.py` — Pydantic request/response models
- `app/orm.py` — SQLAlchemy tables (`Event`, `Profile`, `IdentityLink`, `Destination`, `Delivery`)
- `app/identity.py` — identity merge (link + profile stamp + event backfill)
- `app/crud.py` — DB operations used by routes
- `app/batch.py` — batch ingest item processing (partial success)
- `app/pipeline.py` — enqueue + async parallel tick (`gather` + `Semaphore` + SKIP LOCKED)
- `app/pipeline_telemetry.py` — OpenTelemetry spans/metrics for the tick (App Insights when configured)
- `app/db.py` — engine, `get_db` (migrations are **not** run on startup)
- `alembic/` — versioned DB migrations

## Migrations (PR-gated)
Schema changes apply only after merge to `main`, via **Deploy API**
(`.github/workflows/deploy-api.yml` → Alembic on App Service).

That way:
1. Change goes through a pull request
2. Merge to `main` deploys code
3. Then `alembic upgrade head` runs in Azure (VNet / Private Endpoint path)

Locally (shared/dev DB), apply yourself before testing schema changes:

```bash
cd apps/api
alembic upgrade head
```

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

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## Docker (local = closer to Azure)
Runs the API in **Python 3.12** (same as App Service) with Compose Postgres.

From the **repo root**:

```bash
cp apps/api/.env.docker.example apps/api/.env.docker
docker compose up --build
# other terminal:
docker compose run --rm api alembic upgrade head
```

- API: http://localhost:8000/health  
- DB: `localhost:5432` (user/pass/db `segment`)  
- Code is bind-mounted with `--reload`  
- To use Azure Postgres instead: point `DATABASE_URL` in Compose at Key Vault and remove/stop the `db` service  

Web stays on the host (`apps/web` → `npm run dev`).

## Tests (pytest + dedicated `segment_test` DB)
Uses the **same Alembic schema** as app/dev, with seed data and Entra auth overridden.

```bash
# Postgres (creates `segment` + `segment_test` on first init)
docker compose up -d db

# If the Compose volume already existed before the init script was added:
docker compose exec db psql -U segment -d segment -c 'CREATE DATABASE segment_test;'

cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
# with coverage:
pytest --cov=app --cov-report=term-missing
```

Default `TEST_DATABASE_URL`:
`postgresql://segment:segment@127.0.0.1:5432/segment_test`

Opt-in Azure DB (disposable DB only — never shared prod data):

```bash
RUN_AZURE_DB_TESTS=1 TEST_DATABASE_URL='postgresql://...' pytest -m azure
```

## Schema changes (Alembic)
1. Edit `app/orm.py` on a feature branch
2. `alembic revision --autogenerate -m "what changed"`
3. Review `alembic/versions/…`, open a PR
4. After merge to `main`, Deploy API applies migrations

## Try it
```bash
curl -s http://localhost:8000/health
```
(Authenticated `/v1/*` routes need a Bearer Entra access token.)
