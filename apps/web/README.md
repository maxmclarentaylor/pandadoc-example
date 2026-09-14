# Web (v0)

React event console. **Entra ID login** unlocks the app (`useAuth` + `/v1/me`).

## Run
```bash
cp .env.example .env.local   # once

# terminal 1 — API
cd apps/api && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# terminal 2 — UI
cd apps/web
npm run dev
```

Open http://127.0.0.1:5173 → Sign in with Microsoft.

See `docs/auth.md` for Entra portal steps.
