import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import {
  TOKEN_REFRESH_INTERVAL_MS,
  acquireTokenSilent,
  authConfigured,
  getAccount,
  initMsal,
  login as msalLogin,
  logout as msalLogout,
} from './auth'

export type AuthContextValue = {
  ready: boolean
  configured: boolean
  account: AccountInfo | null
  /** Latest access token kept in context (renewed on an interval + on login). */
  accessToken: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
  /** Prefer this for API calls — returns context token or silently renews. */
  getAccessToken: () => Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const accessTokenRef = useRef<string | null>(null)

  const clearSession = useCallback(() => {
    accessTokenRef.current = null
    setAccessToken(null)
    setAccount(null)
  }, [])

  const renewAccessToken = useCallback(async (): Promise<string> => {
    try {
      const result = await acquireTokenSilent()
      accessTokenRef.current = result.accessToken
      setAccessToken(result.accessToken)
      setAccount(result.account)
      return result.accessToken
    } catch (err) {
      if (err instanceof Error && err.message.includes('Session expired')) {
        clearSession()
      }
      throw err
    }
  }, [clearSession])

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (accessTokenRef.current) {
      return accessTokenRef.current
    }
    return renewAccessToken()
  }, [renewAccessToken])

  useEffect(() => {
    void initMsal().then(async () => {
      const existing = getAccount()
      setAccount(existing)
      if (existing) {
        try {
          await renewAccessToken()
        } catch {
          clearSession()
        }
      }
      setReady(true)
    })
  }, [clearSession, renewAccessToken])

  // Proactive silent refresh while signed in
  useEffect(() => {
    if (!account) {
      return
    }

    const id = window.setInterval(() => {
      void renewAccessToken().catch(() => {
        // renewAccessToken already clears session on expiry
      })
    }, TOKEN_REFRESH_INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [account, renewAccessToken])

  const login = useCallback(async () => {
    const result = await msalLogin()
    setAccount(result.account)
    accessTokenRef.current = result.accessToken
    setAccessToken(result.accessToken)
    // Ensure we have a fresh API-scoped token in cache/context
    await renewAccessToken().catch(() => {
      // loginPopup often already returned a usable access token
    })
  }, [renewAccessToken])

  const logout = useCallback(async () => {
    await msalLogout()
    clearSession()
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured: authConfigured,
      account,
      accessToken,
      login,
      logout,
      getAccessToken,
    }),
    [ready, account, accessToken, login, logout, getAccessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Vanilla Context consumer for auth + bearer token. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
