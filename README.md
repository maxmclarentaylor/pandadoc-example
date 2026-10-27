# segment-practice

A small demo for signing a document, like PandaDoc.

Two libraries are the core of the app. One seals the finished PDF. The other lets two people edit the same page at the same time, the way Google Docs does.

## PDF seal

When both people have signed, the API signs the PDF with **pyHanko**. The signature is embedded in the file. Later, the app reads that signature back and checks the PDF has not been changed.

- `apps/api/app/page_seal.py` — `seal_pdf` writes the signature. `inspect_seal` reads it back.
- `apps/api/app/pages.py` — `update_signing_fields` calls `seal_pdf` on the request that finishes signing. `verify_page_seal` calls `inspect_seal`.
- `apps/api/app/page_pdf.py` — builds the PDF that pyHanko then signs.
- `apps/api/tests/test_page_seal.py` — signs a small PDF with pyHanko and checks the signature.

## Editing together

This is the same kind of feature as Google Docs: two people open one document, both type, and both sets of changes stay. Google Docs built its own version of that. This demo uses **Yjs** in the browser and **pycrdt** on the API. Each browser keeps a Yjs document and sends edits through **y-websocket**. pycrdt speaks the same protocol, so an edit in one place does not wipe an edit in another.

- `apps/web/src/PageEditor.tsx` — opens the Yjs document and connects with `y-websocket`.
- `apps/web/src/collabDoc.ts` — how the page title and blocks are stored in that document.
- `apps/api/app/collab.py` — the pycrdt document and the websocket room.
- `apps/api/app/pages.py` — the `/{page_id}/ws` route that joins a browser to that room.
- `apps/api/tests/test_collab_doc.py` — two edits land in the same document and both remain.

## How to use it

Open the website: https://red-island-0d916eb03.5.azurestaticapps.net

If you are running it on your computer, open http://127.0.0.1:5173 instead.

A Microsoft sign-in box will appear. Sign in with the email and password only. For this demo, two-factor authentication has been removed, so it will not ask for an authenticator app or a second code.

Both accounts use the same password: `ChooseAStrongPassword1!`

| Who | Email | Password |
| --- | --- | --- |
| Editor One | `editor1@maxmclarentayloroutlook.onmicrosoft.com` | `ChooseAStrongPassword1!` |
| Editor Two | `editor2@maxmclarentayloroutlook.onmicrosoft.com` | `ChooseAStrongPassword1!` |

Two different people have to sign. Use a private window for the second person, so the first person stays signed in.

1. You land on **Documents**. There are three tabs: Documents, Pages to sign, and Downloads.
2. Click **New page**. A sales contract is already written for you. The title box says Untitled. Type a name for the document.
3. You can change the words on the page. On the right, you can drag **Text field**, **Signature**, or **Date** onto the page. The contract already has a signature box and a date for the seller, and another pair for the buyer.
4. Click **Save**. You have to save before anything else will work.
5. Click **Lock**. A box asks “Lock this page?” Click **Confirm lock**. After this, the words cannot be changed. Back on Documents, the row shows a **Locked** label.
6. Click **Assignees**. Add two people. Type a name and an email for each one. For the login, pick **Editor One** for the first person and **Editor Two** for the second. Click **Save**.
7. Click **Send for signature**. The button changes to **Sent**. Each person is emailed a link.
8. Open the **Pages to sign** tab. Click your document.
9. At the top, **Who has signed** lists both people. Both say **Not signed** at first.
10. You can only sign if you are logged in as that person. As Editor One, click the first **Signature** box. Draw your name. Click **Accept and sign**. That person now says **Signed**.
11. In the other window, sign in as Editor Two. Open the same document from **Pages to sign**. Sign the other signature box the same way.
12. When both people have signed, the page says it has been sealed. The signature boxes cannot be changed again. On Pages to sign, the row says **Document already signed**.
13. Open the **Downloads** tab. **Download PDF** works only after both people have signed. Before that, the button is grey. Hold the mouse over it and it says you can only download when everyone has signed.
14. On the signed page, **Download PDF** is also next to the seal. The page tells you the signature is intact.

## For developers

Personal practice app. The notes below are for running and deploying it.

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
