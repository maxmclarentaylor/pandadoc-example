# Web (v0)

React event console for the local API.

## Run
```bash
# terminal 1 — API (if not already running)
cd apps/api && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# terminal 2 — UI
cd apps/web
npm run dev
```

Open http://127.0.0.1:5173

Optional: set `VITE_API_BASE` if the API is not on `http://127.0.0.1:8000`.
