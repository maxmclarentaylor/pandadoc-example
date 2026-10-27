# Alembic migrations for segment-practice API

Schema changes live here as versioned scripts.

**Production/dev Azure:** Deploy API sets the App Service startup command so
`alembic upgrade head` runs in the app container (`$APP_PATH/antenv`) before
uvicorn starts.

```bash
# Local / laptop against allow-listed Postgres
alembic upgrade head

# After changing app/orm.py
alembic revision --autogenerate -m "describe the change"
# commit the new versions/*.py file, open a PR, merge → CI migrates
```
