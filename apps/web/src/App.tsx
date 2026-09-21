import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchMe, identifyUser, listEvents, listProfiles, trackEvent } from './api'
import type { EventRecord, MeResponse, ProfileRecord } from './api'
import { useAuth } from './AuthContext'
import './App.css'

function newMessageId() {
  return `msg_${crypto.randomUUID().slice(0, 8)}`
}

export default function App() {
  const { ready, configured, account, login, logout, getAccessToken } = useAuth()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const [messageId, setMessageId] = useState(newMessageId)
  const [userId, setUserId] = useState('user_123')
  const [eventName, setEventName] = useState('Page Viewed')
  const [propertiesJson, setPropertiesJson] = useState('{"path":"/pricing"}')
  const [events, setEvents] = useState<EventRecord[]>([])

  const [identifyUserId, setIdentifyUserId] = useState('user_123')
  const [anonymousId, setAnonymousId] = useState('anon_abc')
  const [traitsJson, setTraitsJson] = useState(
    '{"email":"ada@example.com","name":"Ada","plan":"pro"}',
  )
  const [profiles, setProfiles] = useState<ProfileRecord[]>([])

  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [eventRows, profileRows] = await Promise.all([
        listEvents(30, getAccessToken),
        listProfiles(30, getAccessToken),
      ])
      setEvents(eventRows)
      setProfiles(profileRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    }
  }, [getAccessToken])

  useEffect(() => {
    if (!account) {
      setMe(null)
      setEvents([])
      setProfiles([])
      return
    }
    void (async () => {
      setAuthError(null)
      try {
        const profile = await fetchMe(getAccessToken)
        setMe(profile)
        await refresh()
      } catch (err) {
        setMe(null)
        setAuthError(err instanceof Error ? err.message : 'Failed to validate token with API')
      }
    })()
  }, [account, getAccessToken, refresh])

  async function onTrack(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    setError(null)

    let properties: Record<string, unknown> = {}
    try {
      properties = propertiesJson.trim() ? JSON.parse(propertiesJson) : {}
    } catch {
      setError('Properties must be valid JSON')
      setBusy(false)
      return
    }

    try {
      const result = await trackEvent(
        {
          message_id: messageId,
          user_id: userId || undefined,
          event: eventName,
          properties,
        },
        getAccessToken,
      )
      setStatus(`track ${result.status}: ${result.message_id}`)
      setMessageId(newMessageId())
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Track failed')
    } finally {
      setBusy(false)
    }
  }

  async function onIdentify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    setError(null)

    let traits: Record<string, unknown> = {}
    try {
      traits = traitsJson.trim() ? JSON.parse(traitsJson) : {}
    } catch {
      setError('Traits must be valid JSON')
      setBusy(false)
      return
    }

    try {
      const result = await identifyUser(
        {
          user_id: identifyUserId,
          anonymous_id: anonymousId || undefined,
          traits,
        },
        getAccessToken,
      )
      setStatus(`identify ok: ${result.user_id}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identify failed')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="page">
        <p className="lede">Loading…</p>
      </div>
    )
  }

  if (!account || !me) {
    return (
      <div className="page">
        <header className="hero">
          <p className="brand">segment-practice</p>
          <h1>Sign in</h1>
          <p className="lede">
            Microsoft Entra ID login. The SPA gets an access token; the API verifies the JWT.
          </p>
        </header>

        {!configured ? (
          <p className="flash err">
            Set VITE_AZURE_TENANT_ID, VITE_AZURE_CLIENT_ID, and VITE_AZURE_API_SCOPE (see docs/auth.md).
          </p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAuthError(null)
              void login().catch((err: unknown) => {
                setAuthError(err instanceof Error ? err.message : 'Login failed')
              })
            }}
          >
            Sign in with Microsoft
          </button>
        )}

        {account && !me && !authError ? (
          <p className="lede">Checking access token with API…</p>
        ) : null}
        {authError ? <p className="flash err">{authError}</p> : null}
      </div>
    )
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-top">
          <p className="brand">segment-practice</p>
          <div className="auth-bar">
            <span className="auth-user">{me.preferred_username ?? me.name ?? me.oid}</span>
            <button type="button" className="ghost" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </div>
        <h1>Event console</h1>
        <p className="lede">
          Track = what happened. Identify = who they are (traits). Same Entra token for both.
        </p>
      </header>

      <main className="layout">
        <div className="stack">
          <section className="panel" aria-labelledby="send-heading">
            <div className="panel-head">
              <h2 id="send-heading">Send event</h2>
              <p>POST /v1/track</p>
            </div>

            <form className="form" onSubmit={onTrack}>
              <label>
                Message ID
                <input value={messageId} onChange={(e) => setMessageId(e.target.value)} required />
              </label>
              <label>
                User ID
                <input value={userId} onChange={(e) => setUserId(e.target.value)} required />
              </label>
              <label>
                Event
                <input value={eventName} onChange={(e) => setEventName(e.target.value)} required />
              </label>
              <label>
                Properties (JSON)
                <textarea
                  value={propertiesJson}
                  onChange={(e) => setPropertiesJson(e.target.value)}
                  rows={4}
                  spellCheck={false}
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Track event'}
              </button>
            </form>
          </section>

          <section className="panel" aria-labelledby="identify-heading">
            <div className="panel-head">
              <h2 id="identify-heading">Identify user</h2>
              <p>POST /v1/identify</p>
            </div>

            <form className="form" onSubmit={onIdentify}>
              <label>
                User ID
                <input
                  value={identifyUserId}
                  onChange={(e) => setIdentifyUserId(e.target.value)}
                  required
                />
              </label>
              <label>
                Anonymous ID (optional)
                <input value={anonymousId} onChange={(e) => setAnonymousId(e.target.value)} />
              </label>
              <label>
                Traits (JSON)
                <textarea
                  value={traitsJson}
                  onChange={(e) => setTraitsJson(e.target.value)}
                  rows={4}
                  spellCheck={false}
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Identify'}
              </button>
            </form>
          </section>

          {status && <p className="flash ok">{status}</p>}
          {error && <p className="flash err">{error}</p>}
        </div>

        <div className="stack">
          <section className="panel" aria-labelledby="list-heading">
            <div className="panel-head row">
              <div>
                <h2 id="list-heading">Recent events</h2>
                <p>GET /v1/events</p>
              </div>
              <button type="button" className="ghost" onClick={() => void refresh()}>
                Refresh
              </button>
            </div>

            {events.length === 0 ? (
              <p className="empty">No events yet. Send one from the form.</p>
            ) : (
              <ul className="event-list">
                {events.map((ev) => (
                  <li key={ev.message_id}>
                    <div className="event-top">
                      <strong>{ev.event}</strong>
                      <time dateTime={ev.received_at}>
                        {new Date(ev.received_at).toLocaleString()}
                      </time>
                    </div>
                    <div className="meta">
                      <span>{ev.user_id ?? ev.anonymous_id ?? '—'}</span>
                      <span className="mono">{ev.message_id}</span>
                    </div>
                    <pre>{JSON.stringify(ev.properties, null, 2)}</pre>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="profiles-heading">
            <div className="panel-head">
              <h2 id="profiles-heading">Profiles</h2>
              <p>GET /v1/profiles</p>
            </div>

            {profiles.length === 0 ? (
              <p className="empty">No profiles yet. Identify a user.</p>
            ) : (
              <ul className="event-list">
                {profiles.map((p) => (
                  <li key={p.user_id}>
                    <div className="event-top">
                      <strong>{p.user_id}</strong>
                      <time dateTime={p.updated_at}>
                        {new Date(p.updated_at).toLocaleString()}
                      </time>
                    </div>
                    <div className="meta">
                      <span>{p.anonymous_id ?? 'no anon id'}</span>
                    </div>
                    <pre>{JSON.stringify(p.traits, null, 2)}</pre>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
