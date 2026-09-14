import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser'

const tenantId = import.meta.env.VITE_AZURE_TENANT_ID as string | undefined
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined
const apiScope = import.meta.env.VITE_AZURE_API_SCOPE as string | undefined

export const authConfigured = Boolean(tenantId && clientId && apiScope)

const scopes = apiScope ? [apiScope] : []

export const msal = new PublicClientApplication({
  auth: {
    clientId: clientId ?? 'missing-client-id',
    authority: `https://login.microsoftonline.com/${tenantId ?? 'common'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    // Persist across reloads so acquireTokenSilent can renew without a popup
    cacheLocation: 'localStorage',
  },
})

let ready: Promise<void> | null = null

export function initMsal(): Promise<void> {
  if (!ready) {
    ready = msal.initialize().then(async () => {
      let account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null

      // Soft restore: use existing SSO session if we have no cached account yet
      if (!account && authConfigured) {
        try {
          const sso = await msal.ssoSilent({ scopes })
          account = sso.account
        } catch {
          // No silent SSO available — user must click Sign in
        }
      }

      if (account) {
        msal.setActiveAccount(account)
      }
    })
  }
  return ready
}

export function getAccount(): AccountInfo | null {
  return msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null
}

export function isInteractionRequired(err: unknown): boolean {
  return err instanceof InteractionRequiredAuthError
}

/** Interactive login only — Microsoft hosted UI (popup). */
export async function login(): Promise<AccountInfo> {
  await initMsal()
  const result = await msal.loginPopup({ scopes })
  msal.setActiveAccount(result.account)
  return result.account
}

export async function logout(): Promise<void> {
  await initMsal()
  const account = getAccount()
  await msal.logoutPopup({ account: account ?? undefined })
  msal.setActiveAccount(null)
}

/**
 * Access token for API calls — silent only.
 * MSAL renews via the cached refresh token when the access token is near expiry.
 * If Entra requires user interaction again, throws (UI should send user to Sign in).
 */
export async function getAccessToken(): Promise<string> {
  await initMsal()
  if (!authConfigured) {
    throw new Error('Missing VITE_AZURE_TENANT_ID / VITE_AZURE_CLIENT_ID / VITE_AZURE_API_SCOPE')
  }

  const account = getAccount()
  if (!account) {
    throw new Error('Not signed in')
  }

  try {
    const silent = await msal.acquireTokenSilent({ account, scopes })
    return silent.accessToken
  } catch (err) {
    if (isInteractionRequired(err)) {
      msal.setActiveAccount(null)
      throw new Error('Session expired — sign in again')
    }
    throw err
  }
}
