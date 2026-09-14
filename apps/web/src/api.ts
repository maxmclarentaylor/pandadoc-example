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

export type MeResponse = {
  oid: string | null
  name: string | null
  preferred_username: string | null
  scp: string | null
  aud: string | string[] | null
  iss: string | null
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

function bearerHeaders(accessToken: string, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }
  if (json) {
    headers['Content-Type'] = 'application/json'
  }
  return headers
}

/** Call a protected route with an Entra access token. */
export async function fetchMe(accessToken: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/v1/me`, {
    headers: bearerHeaders(accessToken),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || `Me failed (${res.status})`)
  }
  return res.json()
}

export async function trackEvent(
  payload: TrackPayload,
  accessToken: string,
): Promise<{ status: string; message_id: string }> {
  const res = await fetch(`${API_BASE}/v1/track`, {
    method: 'POST',
    headers: bearerHeaders(accessToken, true),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || `Track failed (${res.status})`)
  }
  return res.json()
}

export async function listEvents(limit = 20, accessToken: string): Promise<EventRecord[]> {
  const res = await fetch(`${API_BASE}/v1/events?limit=${limit}`, {
    headers: bearerHeaders(accessToken),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || `List failed (${res.status})`)
  }
  return res.json()
}
