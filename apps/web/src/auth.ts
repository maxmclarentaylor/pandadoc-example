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

let ready: Promise<AuthenticationResult | null> | null = null

/**
 * Initialize MSAL and finish any redirect that just returned to this tab.
 * Returns the redirect result when the user just signed in, otherwise null.
 */
export function initMsal(): Promise<AuthenticationResult | null> {
  if (!ready) {
    ready = (async () => {
      await msal.initialize()
      const redirectResult = await msal.handleRedirectPromise()
      if (redirectResult?.account) {
        msal.setActiveAccount(redirectResult.account)
        return redirectResult
      }

      const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null
      // Do not call ssoSilent here — that would skip the Entra UI using the browser cookie.
      if (account) {
        msal.setActiveAccount(account)
      }
      return null
    })()
  }
  return ready
}

export function getAccount(): AccountInfo | null {
  return msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null
}

export function isInteractionRequired(err: unknown): boolean {
  return err instanceof InteractionRequiredAuthError
}

/** Sends this tab to Entra. The auth result comes back through handleRedirectPromise. */
export async function login(): Promise<void> {
  await initMsal()
  // Always show Entra UI (don't silently reuse the Microsoft browser SSO session).
  await msal.loginRedirect({
    scopes,
    prompt: 'select_account',
  })
}

/** Sends this tab to Entra logout, then back to the app origin. */
export async function logout(): Promise<void> {
  await initMsal()
  const account = getAccount()
  await msal.logoutRedirect({
    account: account ?? undefined,
    // End the Microsoft session for this account so the next sign-in is not silent SSO.
    postLogoutRedirectUri: window.location.origin,
  })
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
