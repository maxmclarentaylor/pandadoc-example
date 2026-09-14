import { useCallback, useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import {
  authConfigured,
  getAccessToken,
  getAccount,
  initMsal,
  login as msalLogin,
  logout as msalLogout,
} from './auth'

export type AuthState = {
  ready: boolean
  configured: boolean
  account: AccountInfo | null
  login: () => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => Promise<string>
}

/** Simple Entra login hook — MSAL popup + access token for the API. */
export function useAuth(): AuthState {
  const [ready, setReady] = useState(false)
  const [account, setAccount] = useState<AccountInfo | null>(null)

  useEffect(() => {
    void initMsal().then(() => {
      setAccount(getAccount())
      setReady(true)
    })
  }, [])

  const login = useCallback(async () => {
    const next = await msalLogin()
    setAccount(next)
  }, [])

  const logout = useCallback(async () => {
    await msalLogout()
    setAccount(null)
  }, [])

  return {
    ready,
    configured: authConfigured,
    account,
    login,
    logout,
    getAccessToken,
  }
}
