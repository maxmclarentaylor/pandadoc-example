# Architecture (v0)

## Product slice
- Ingest events (Segment-like)
- Store + query recent events (Mixpanel-like, minimal)

## Components
- **web (React):** send test events, list recent events
- **api (Python):** HTTP API
- **db (SQL):** durable event store
- **infra (Terraform):** Azure resources for `dev`

## Event model (v0)
| Field | Notes |
|--------|--------|
| `message_id` | unique; idempotent writes |
| `anonymous_id` / `user_id` | who |
| `event` | name, e.g. `Page Viewed` |
| `properties` | JSON object |
| `timestamp` | when it happened |

## API (v0)
- `POST /v1/track` — accept one event, write to SQL
- `GET /v1/events` — return recent events

## Azure naming (dev)
- Resource group: `segment-practice-dev-rg`
- Key Vault: `segmentpracticedevkv`
- Region: `UK South`

## Out of scope for v0
Multi-destination routing, funnels/cohorts, streaming, prod env
