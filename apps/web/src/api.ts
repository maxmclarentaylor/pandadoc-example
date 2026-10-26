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

/**
 * Authenticated DELETE. Sends the Entra access token as a Bearer JWT.
 * @param endpoint path under the API
 * @param getAccessToken from `useAuth()`
 */
export async function apiDelete(endpoint: string, getAccessToken: GetAccessToken): Promise<void> {
  const accessToken = await getAccessToken()
  const res = await fetch(buildUrl(endpoint), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!res.ok) {
    await parseError(res, `DELETE ${endpoint} failed`)
  }
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
  emails_sent?: boolean
  signing_complete?: boolean
}

export type PageDocument = {
  id: string
  title: string
  chunks: Chunk[]
  locked: boolean
  content_hash: string | null
  emails_sent: boolean
  signing_complete: boolean
  sealed: boolean
  sealed_at: string | null
  pdf_hash: string | null
  has_pdf: boolean
}

export type PageWrite = {
  title: string
  chunks: Chunk[]
}

/** Names of pages saved for the signed-in user. Does not include chunks. */
export function fetchPages(getAccessToken: GetAccessToken): Promise<PageSummary[]> {
  return apiGet<PageSummary[]>('/v1/pages', getAccessToken)
}

/** Locked pages marked as sent for signature (no real email yet). */
export function fetchPagesToSign(getAccessToken: GetAccessToken): Promise<PageSummary[]> {
  return apiGet<PageSummary[]>('/v1/pages/to-sign', getAccessToken)
}

/** Mark a locked page as sent. Does not deliver email yet. */
export function markPageSent(pageId: string, getAccessToken: GetAccessToken): Promise<PageDocument> {
  return apiPost<PageDocument>(`/v1/pages/${pageId}/send`, {}, getAccessToken)
}

/**
 * Save signature/date field edits on a locked, sent page.
 * When this save completes signing, the server seals the PDF and returns sealed: true.
 */
export function saveSigningFields(
  pageId: string,
  chunks: Chunk[],
  getAccessToken: GetAccessToken,
): Promise<PageDocument> {
  return apiPost<PageDocument>(`/v1/pages/${pageId}/signing-fields`, { chunks }, getAccessToken)
}

/** One saved page, including its chunks. */
export function fetchPage(pageId: string, getAccessToken: GetAccessToken): Promise<PageDocument> {
  return apiGet<PageDocument>(`/v1/pages/${pageId}`, getAccessToken)
}

/** Creates a page. The API assigns the id. */
export function createPage(body: PageWrite, getAccessToken: GetAccessToken): Promise<PageDocument> {
  return apiPost<PageDocument>('/v1/pages', body, getAccessToken)
}

/** Deletes a page. Any signed-in user can delete any page for now. */
export function deletePage(pageId: string, getAccessToken: GetAccessToken): Promise<void> {
  return apiDelete(`/v1/pages/${pageId}`, getAccessToken)
}

/** Replaces the title and chunks of an existing page. */
export function updatePage(
  pageId: string,
  body: PageWrite,
  getAccessToken: GetAccessToken,
): Promise<PageDocument> {
  return apiPut<PageDocument>(`/v1/pages/${pageId}`, body, getAccessToken)
}

/** Freeze the page snapshot in Postgres and store its content hash + PDF. */
export function lockPage(
  pageId: string,
  body: PageWrite,
  getAccessToken: GetAccessToken,
): Promise<PageDocument> {
  return apiPost<PageDocument>(`/v1/pages/${pageId}/lock`, body, getAccessToken)
}

/** Download the frozen PDF for a locked page. */
export async function downloadPagePdf(
  pageId: string,
  getAccessToken: GetAccessToken,
  filename = 'page.pdf',
): Promise<void> {
  const accessToken = await getAccessToken()
  const res = await fetch(buildUrl(`/v1/pages/${pageId}/pdf`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!res.ok) {
    await parseError(res, `GET /v1/pages/${pageId}/pdf failed`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
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

/** Demo-only Entra logins for local signing. Not a production pattern. */
export const DEMO_ENTRA_USERS = [
  {
    label: 'Editor One',
    upn: 'editor1@maxmclarentayloroutlook.onmicrosoft.com',
  },
  {
    label: 'Editor Two',
    upn: 'editor2@maxmclarentayloroutlook.onmicrosoft.com',
  },
] as const

export type PageAssignee = {
  id: string
  name: string
  email: string
  demo_entra_upn: string
  signed_at: string | null
  sort_order: number
}

export type AssigneeWrite = {
  name: string
  email: string
  demo_entra_upn: string
}

/** Assignees saved for a page. Email is not sent yet. */
export function fetchAssignees(
  pageId: string,
  getAccessToken: GetAccessToken,
): Promise<PageAssignee[]> {
  return apiGet<PageAssignee[]>(`/v1/pages/${pageId}/assignees`, getAccessToken)
}

/** Replace the full assignee list for a locked page. */
export function saveAssignees(
  pageId: string,
  assignees: AssigneeWrite[],
  getAccessToken: GetAccessToken,
): Promise<PageAssignee[]> {
  return apiPut<PageAssignee[]>(`/v1/pages/${pageId}/assignees`, { assignees }, getAccessToken)
}
