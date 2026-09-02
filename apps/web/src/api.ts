export type TrackPayload = {
  message_id: string
  event: string
  user_id?: string
  anonymous_id?: string
  properties?: Record<string, unknown>
}

export type EventRecord = {
  message_id: string
  anonymous_id: string | null
  user_id: string | null
  event: string
  properties: Record<string, unknown>
  event_timestamp: string
  received_at: string
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

export async function trackEvent(payload: TrackPayload): Promise<{ status: string; message_id: string }> {
  const res = await fetch(`${API_BASE}/v1/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || `Track failed (${res.status})`)
  }
  return res.json()
}

export async function listEvents(limit = 20): Promise<EventRecord[]> {
  const res = await fetch(`${API_BASE}/v1/events?limit=${limit}`)
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || `List failed (${res.status})`)
  }
  return res.json()
}
