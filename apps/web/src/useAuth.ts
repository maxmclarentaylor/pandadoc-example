import { useCallback, useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import {
  authConfigured,
  getAccessToken as msalGetAccessToken,
  getAccount,
  initMsal,
  isInteractionRequired,
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

/** Entra login hook — interactive login; silent token renewal for API calls. */
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

  const getAccessToken = useCallback(async () => {
    try {
      return await msalGetAccessToken()
    } catch (err) {
      // Silent renew failed and needs a human — drop local session so login gate shows
      if (
        isInteractionRequired(err) ||
        (err instanceof Error && err.message.includes('Session expired'))
      ) {
        setAccount(null)
      }
      throw err
    }
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
