import type { Chunk } from './chunks/types'

/** Resolves a Bearer access token (from AuthContext / useAuth). */
export type GetAccessToken = () => Promise<string>

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
 * Authenticated GET. Sends the Entra access token as a Bearer JWT.
 * @param endpoint e.g. `/v1/me`
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
 * Authenticated POST. Sends the Entra access token as a Bearer JWT.
 * @param endpoint path under the API
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

/**
 * Authenticated PUT. Sends the Entra access token as a Bearer JWT.
 * @param endpoint path under the API
 * @param body JSON-serializable request body
 * @param getAccessToken from `useAuth()`
 */
export async function apiPut<T>(
  endpoint: string,
  body: unknown,
  getAccessToken: GetAccessToken,
): Promise<T> {
  const accessToken = await getAccessToken()
  const res = await fetch(buildUrl(endpoint), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    await parseError(res, `PUT ${endpoint} failed`)
  }
  return res.json() as Promise<T>
}

/** Calls GET /v1/me so the API can verify the Entra JWT. */
export function fetchMe(getAccessToken: GetAccessToken): Promise<MeResponse> {
  return apiGet<MeResponse>('/v1/me', getAccessToken)
}

/** WebSocket base and room for one page. The provider appends the room to the base. */
export function pageCollabUrl(pageId: string): { serverUrl: string; room: string } {
  const serverUrl = API_BASE.replace(/^http/, 'ws')
  return { serverUrl, room: `v1/pages/${pageId}/ws` }
}

export type PageSummary = {
  id: string
  title: string
  locked?: boolean
}

export type PageDocument = {
  id: string
  title: string
  chunks: Chunk[]
  locked: boolean
  content_hash: string | null
}

export type PageWrite = {
  title: string
  chunks: Chunk[]
}

/** Names of pages saved for the signed-in user. Does not include chunks. */
export function fetchPages(getAccessToken: GetAccessToken): Promise<PageSummary[]> {
  return apiGet<PageSummary[]>('/v1/pages', getAccessToken)
}

/** One saved page, including its chunks. */
export function fetchPage(pageId: string, getAccessToken: GetAccessToken): Promise<PageDocument> {
  return apiGet<PageDocument>(`/v1/pages/${pageId}`, getAccessToken)
}

/** Creates a page. The API assigns the id. */
export function createPage(body: PageWrite, getAccessToken: GetAccessToken): Promise<PageDocument> {
  return apiPost<PageDocument>('/v1/pages', body, getAccessToken)
}

/** Replaces the title and chunks of an existing page. */
export function updatePage(
  pageId: string,
  body: PageWrite,
  getAccessToken: GetAccessToken,
): Promise<PageDocument> {
  return apiPut<PageDocument>(`/v1/pages/${pageId}`, body, getAccessToken)
}

/** Freeze the page snapshot in Postgres and store its content hash. */
export function lockPage(
  pageId: string,
  body: PageWrite,
  getAccessToken: GetAccessToken,
): Promise<PageDocument> {
  return apiPost<PageDocument>(`/v1/pages/${pageId}/lock`, body, getAccessToken)
}

/** Clear the Postgres lock so the page can be edited again. */
export function unlockPage(pageId: string, getAccessToken: GetAccessToken): Promise<PageDocument> {
  return apiPost<PageDocument>(`/v1/pages/${pageId}/unlock`, {}, getAccessToken)
}

export type PageIntegrity = {
  id: string
  locked: boolean
  content_hash: string | null
  computed_hash: string
  matches: boolean
}

/** Re-hash the stored snapshot and compare it to content_hash. */
export function verifyPageIntegrity(
  pageId: string,
  getAccessToken: GetAccessToken,
): Promise<PageIntegrity> {
  return apiGet<PageIntegrity>(`/v1/pages/${pageId}/integrity`, getAccessToken)
}
