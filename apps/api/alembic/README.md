# Alembic migrations for segment-practice API

Schema changes live here as versioned scripts.

**Production/dev Azure:** migrations run from GitHub Actions after merge to
`main` (see `.github/workflows/deploy-api.yml`) — not on API startup.

```bash
# Local / laptop against allow-listed Postgres
alembic upgrade head

# After changing app/orm.py
alembic revision --autogenerate -m "describe the change"
# commit the new versions/*.py file, open a PR, merge → CI migrates
```
