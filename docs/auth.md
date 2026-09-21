# Entra ID login (vanilla Stage 2)

**Sign in with Microsoft**, get an access token in the SPA, send it on API calls,
decode/verify the JWT. Protected routes: `/v1/me`, `/v1/track`, `/v1/events`.
`/health` stays public.

```
Browser → Entra login (once) → access token stored in React Context
       → every 15 minutes: silent renew (acquireTokenSilent) updates Context
       → apiGet / apiPost(endpoint, getAccessToken, body?) attach Bearer token
       → API verifies JWT
```

| Piece | Role |
|-------|------|
| `AuthProvider` / `useAuth` | Vanilla Context — account + `accessToken` + `getAccessToken` |
| `TOKEN_REFRESH_INTERVAL_MS` | Proactive silent refresh (15 minutes) |
| `apiGet` / `apiPost` | Dynamic REST helpers for any endpoint |
| `fetchMe` / `listEvents` / `trackEvent` | Thin wrappers over `apiGet` / `apiPost` |

Interactive popup is only for **Sign in** / **Sign out**.

## Portal setup (Entra admin center)

You already have two app registrations from earlier. Confirm them in the GUI:

**Microsoft Entra ID → App registrations**

### 1) API app — `segment-practice-api`
- Application (client) ID: `a4f8ea2d-a323-4974-96f2-f796ea0b18c0`
- **Expose an API** → Application ID URI: `api://a4f8ea2d-a323-4974-96f2-f796ea0b18c0`
- Scope: `access_as_user` (Admins and users can consent)
- **App roles** not required for this first pass

### 2) SPA app — `segment-practice-spa`
- Application (client) ID: `35fe918e-5d85-456d-8c49-776548401e86`
- **Authentication** → platform **Single-page application** redirect URIs:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - `https://red-island-0d916eb03.5.azurestaticapps.net`
- **API permissions** → add delegated permission
  `segment-practice-api` → `access_as_user`
- Click **Grant admin consent** for your tenant (if shown)

Tenant ID: `c97ce120-adbc-4e5b-b458-5acbac0bc05f`

## Do you need a new user?

**No — not for yourself.** Sign in with the Microsoft account that already owns this
tenant (`max.mclaren.taylor@outlook.com` / whatever user you use in the Azure portal).

The apps are set to **Accounts in this organizational directory only**. That means:
- Users **in this Entra tenant** can sign in
- Random personal Outlook accounts **outside** the tenant cannot

To add someone else later:
1. Entra ID → **Users** → **New user** (or **Invite external user**)
2. They sign in with that identity

No special “app role” assignment is required for this first login gate — successful
token validation is enough.

## Local env

`apps/api/.env`:
```
AZURE_TENANT_ID=c97ce120-adbc-4e5b-b458-5acbac0bc05f
AZURE_API_CLIENT_ID=a4f8ea2d-a323-4974-96f2-f796ea0b18c0
AZURE_API_AUDIENCE=api://a4f8ea2d-a323-4974-96f2-f796ea0b18c0
```

`apps/web/.env.local` (from `.env.example`):
```
VITE_AZURE_TENANT_ID=…
VITE_AZURE_CLIENT_ID=…          # SPA client id
VITE_AZURE_API_SCOPE=api://a4f8ea2d-a323-4974-96f2-f796ea0b18c0/access_as_user
```

## Code map

| Piece | Role |
|-------|------|
| `apps/web/src/AuthContext.tsx` | Context provider + `useAuth` |
| `apps/web/src/auth.ts` | Thin MSAL wrapper |
| `apps/web/src/api.ts` | `apiGet` / `apiPost` + route helpers |
| `apps/api/app/auth.py` | JWT decode via Entra JWKS |
| `GET /v1/me` | Protected route that returns decoded claims |

## Smoke test

1. `npm run dev` + API running
2. Sign in with Microsoft (popup)
3. App calls `/v1/me` with the token → console unlocks
4. `curl` without token to `/v1/me`, `/v1/track`, or `/v1/events` → **401**
5. Signed-in console can track and list events
