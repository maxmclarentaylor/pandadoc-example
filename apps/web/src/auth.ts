import { PublicClientApplication, type AccountInfo } from '@azure/msal-browser'

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
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
})

let ready: Promise<void> | null = null

export function initMsal(): Promise<void> {
  if (!ready) {
    ready = msal.initialize().then(() => {
      const accounts = msal.getAllAccounts()
      if (accounts[0]) {
        msal.setActiveAccount(accounts[0])
      }
    })
  }
  return ready
}

export function getAccount(): AccountInfo | null {
  return msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null
}

/** Interactive login (Microsoft hosted UI). */
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
}

/**
 * Get an access token for the API.
 * Tries cache first; falls back to interactive popup (silent refresh comes later).
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
  } catch {
    const interactive = await msal.acquireTokenPopup({ account, scopes })
    return interactive.accessToken
  }
}
