/** Resolves a Bearer access token (from AuthContext / useAuth). */
export type GetAccessToken = () => Promise<string>

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

export type IdentifyPayload = {
  user_id: string
  anonymous_id?: string
  traits?: Record<string, unknown>
}

export type ProfileRecord = {
  user_id: string
  anonymous_id: string | null
  traits: Record<string, unknown>
  updated_at: string
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

function buildUrl(endpoint: string, query?: Record<string, string | number | boolean | undefined>) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = new URL(`${API_BASE}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const detail = await res.text()
  throw new Error(detail || `${fallback} (${res.status})`)
}

/**
 * Dynamic authenticated GET.
 * @param endpoint e.g. `/v1/me` or `v1/events`
 * @param getAccessToken from `useAuth()`
 */
export async function apiGet<T>(
  endpoint: string,
  getAccessToken: GetAccessToken,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const accessToken = await getAccessToken()
  const res = await fetch(buildUrl(endpoint, query), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!res.ok) {
    await parseError(res, `GET ${endpoint} failed`)
  }
  return res.json() as Promise<T>
}

/**
 * Dynamic authenticated POST.
 * @param endpoint e.g. `/v1/track`
 * @param body JSON-serializable request body
 * @param getAccessToken from `useAuth()`
 */
export async function apiPost<T>(
  endpoint: string,
  body: unknown,
  getAccessToken: GetAccessToken,
): Promise<T> {
  const accessToken = await getAccessToken()
  const res = await fetch(buildUrl(endpoint), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    await parseError(res, `POST ${endpoint} failed`)
  }
  return res.json() as Promise<T>
}

/** Convenience wrappers — all go through apiGet / apiPost. */

export function fetchMe(getAccessToken: GetAccessToken): Promise<MeResponse> {
  return apiGet<MeResponse>('/v1/me', getAccessToken)
}

export function listEvents(limit: number, getAccessToken: GetAccessToken): Promise<EventRecord[]> {
  return apiGet<EventRecord[]>('/v1/events', getAccessToken, { limit })
}

export function trackEvent(
  payload: TrackPayload,
  getAccessToken: GetAccessToken,
): Promise<{ status: string; message_id: string }> {
  return apiPost<{ status: string; message_id: string }>('/v1/track', payload, getAccessToken)
}

export function identifyUser(
  payload: IdentifyPayload,
  getAccessToken: GetAccessToken,
): Promise<{ status: string; user_id: string; traits: Record<string, unknown> }> {
  return apiPost<{ status: string; user_id: string; traits: Record<string, unknown> }>(
    '/v1/identify',
    payload,
    getAccessToken,
  )
}

export function listProfiles(
  limit: number,
  getAccessToken: GetAccessToken,
): Promise<ProfileRecord[]> {
  return apiGet<ProfileRecord[]>('/v1/profiles', getAccessToken, { limit })
}
