import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { listEvents, trackEvent } from './api'
import type { EventRecord } from './api'
import './App.css'

function newMessageId() {
  return `msg_${crypto.randomUUID().slice(0, 8)}`
}

export default function App() {
  const [messageId, setMessageId] = useState(newMessageId)
  const [userId, setUserId] = useState('user_123')
  const [eventName, setEventName] = useState('Page Viewed')
  const [propertiesJson, setPropertiesJson] = useState('{"path":"/pricing"}')
  const [events, setEvents] = useState<EventRecord[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const rows = await listEvents(30)
      setEvents(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onSubmit(e: FormEvent) {
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
      const result = await trackEvent({
        message_id: messageId,
        user_id: userId || undefined,
        event: eventName,
        properties,
      })
      setStatus(`${result.status}: ${result.message_id}`)
      setMessageId(newMessageId())
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Track failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="brand">segment-practice</p>
        <h1>Event console</h1>
        <p className="lede">
          Send Segment-style track calls and inspect recent events from Postgres.
        </p>
      </header>

      <main className="layout">
        <section className="panel" aria-labelledby="send-heading">
          <div className="panel-head">
            <h2 id="send-heading">Send event</h2>
            <p>POST /v1/track</p>
          </div>

          <form className="form" onSubmit={onSubmit}>
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

          {status && <p className="flash ok">{status}</p>}
          {error && <p className="flash err">{error}</p>}
        </section>

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
      </main>
    </div>
  )
}
