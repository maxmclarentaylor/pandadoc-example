import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
} from '@azure/msal-browser'

const tenantId = import.meta.env.VITE_AZURE_TENANT_ID as string | undefined
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined
const apiScope = import.meta.env.VITE_AZURE_API_SCOPE as string | undefined

export const authConfigured = Boolean(tenantId && clientId && apiScope)

/** How often AuthProvider silently renews the access token in the background. */
export const TOKEN_REFRESH_INTERVAL_MS = 15 * 60 * 1000

const scopes = apiScope ? [apiScope] : []

export const msal = new PublicClientApplication({
  auth: {
    clientId: clientId ?? 'missing-client-id',
    authority: `https://login.microsoftonline.com/${tenantId ?? 'common'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
})

let ready: Promise<void> | null = null

export function initMsal(): Promise<void> {
  if (!ready) {
    ready = msal.initialize().then(async () => {
      let account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null

      if (!account && authConfigured) {
        try {
          const sso = await msal.ssoSilent({ scopes })
          account = sso.account
        } catch {
          // User must click Sign in
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

export async function login(): Promise<AuthenticationResult> {
  await initMsal()
  const result = await msal.loginPopup({ scopes })
  msal.setActiveAccount(result.account)
  return result
}

export async function logout(): Promise<void> {
  await initMsal()
  const account = getAccount()
  await msal.logoutPopup({ account: account ?? undefined })
  msal.setActiveAccount(null)
}

/**
 * Silent acquire — uses MSAL cache / refresh token. No UI.
 * Returns the full result so callers can store the access token.
 */
export async function acquireTokenSilent(): Promise<AuthenticationResult> {
  await initMsal()
  if (!authConfigured) {
    throw new Error('Missing VITE_AZURE_TENANT_ID / VITE_AZURE_CLIENT_ID / VITE_AZURE_API_SCOPE')
  }

  const account = getAccount()
  if (!account) {
    throw new Error('Not signed in')
  }

  try {
    return await msal.acquireTokenSilent({ account, scopes })
  } catch (err) {
    if (isInteractionRequired(err)) {
      msal.setActiveAccount(null)
      throw new Error('Session expired — sign in again')
    }
    throw err
  }
}
