import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  downloadPagePdf,
  fetchAssignees,
  fetchMe,
  fetchPage,
  saveSigningFields,
  verifyPageSeal,
  type PageAssignee,
  type SealCheck,
} from '../api'
import { useAuth } from '../AuthContext'
import SealPanel from '../SealPanel'
import type { Chunk } from '../chunks/types'
import PageDocumentView from './PageDocumentView'
import { readChunks } from './readChunks'
import './SignPageView.css'

export default function SignPageView() {
  const { pageId } = useParams()
  const navigate = useNavigate()
  const { ready, account, login, getAccessToken } = useAuth()
  const [title, setTitle] = useState('Untitled')
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [signers, setSigners] = useState<PageAssignee[]>([])
  const [contentHash, setContentHash] = useState<string | null>(null)
  const [signingComplete, setSigningComplete] = useState(false)
  const [sealed, setSealed] = useState(false)
  const [sealCheck, setSealCheck] = useState<SealCheck | null>(null)
  const [sealBusy, setSealBusy] = useState(false)
  const [sealError, setSealError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || !pageId) {
      return
    }

    let cancel = false

    async function loadPage() {
      setLoading(true)
      setError(null)
      try {
        if (!account) {
          await login()
        }
        await fetchMe(getAccessToken)
        const page = await fetchPage(pageId!, getAccessToken)
        if (cancel) {
          return
        }
        if (!page.locked || !page.emails_sent) {
          setError('This page is not available for signing yet.')
          setChunks([])
          return
        }
        const people = await fetchAssignees(pageId!, getAccessToken)
        if (cancel) {
          return
        }
        setTitle(page.title)
        setChunks(readChunks(page.chunks))
        setSigners(people)
        setContentHash(page.content_hash)
        setSigningComplete(page.signing_complete)
        setSealed(page.sealed)
      } catch (err) {
        if (!cancel) {
          setError(err instanceof Error ? err.message : 'Could not open this page')
        }
      } finally {
        if (!cancel) {
          setLoading(false)
        }
      }
    }

    void loadPage()
    return () => {
      cancel = true
    }
  }, [ready, account, login, getAccessToken, pageId])

  useEffect(() => {
    if (!pageId || !sealed) {
      setSealCheck(null)
      setSealError(null)
      setSealBusy(false)
      return
    }

    let cancel = false
    setSealBusy(true)
    setSealError(null)
    verifyPageSeal(pageId, getAccessToken)
      .then((result) => {
        if (!cancel) {
          setSealCheck(result)
        }
      })
      .catch((err: unknown) => {
        if (!cancel) {
          setSealError(err instanceof Error ? err.message : 'Could not check the seal')
        }
      })
      .finally(() => {
        if (!cancel) {
          setSealBusy(false)
        }
      })
    return () => {
      cancel = true
    }
  }, [pageId, sealed, getAccessToken])

  async function handleDownloadPdf() {
    if (!pageId) {
      return
    }
    setPdfBusy(true)
    setSaveError(null)
    try {
      const safe = (title.trim() || 'page').replace(/[^\w.\-]+/g, '_').slice(0, 80)
      await downloadPagePdf(pageId, getAccessToken, `${safe || 'page'}.pdf`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not download PDF')
    } finally {
      setPdfBusy(false)
    }
  }

  async function handleChunkChange(next: Chunk) {
    if (!pageId || saving) {
      return
    }
    const updated = chunks.map((chunk) => (chunk.id === next.id ? next : chunk))
    setChunks(updated)
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await saveSigningFields(pageId, updated, getAccessToken)
      setContentHash(saved.content_hash)
      setChunks(readChunks(saved.chunks))
      setSigningComplete(saved.signing_complete)
      setSealed(saved.sealed)
      try {
        setSigners(await fetchAssignees(pageId, getAccessToken))
      } catch {
        // The signature is already saved. The list updates on the next open.
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save signature changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="sign-page">
      <header className="sign-page-header">
        <button type="button" className="sign-page-back" onClick={() => navigate('/pages-to-sign')}>
          Pages to sign
        </button>
        <p className="sign-page-note">Signature and date fields only</p>
        {saving ? <p className="sign-page-status">Saving…</p> : null}
        {!saving && contentHash ? (
          <p className="sign-page-hash" title={contentHash}>
            Snapshot SHA-256 <code>{contentHash.slice(0, 12)}…</code>
          </p>
        ) : null}
      </header>
      {sealed ? (
        <SealPanel
          check={sealCheck}
          busy={sealBusy}
          error={sealError}
          onDownload={() => void handleDownloadPdf()}
          downloading={pdfBusy}
        />
      ) : null}
      {loading ? <p className="sign-page-status">Loading…</p> : null}
      {error ? (
        <p className="sign-page-error" role="alert">
          {error}
        </p>
      ) : null}
      {saveError ? (
        <p className="sign-page-error" role="alert">
          {saveError}
        </p>
      ) : null}
      {!loading && !error && signers.length > 0 ? (
        <section className="sign-page-signers" aria-label="Who has signed">
          <h2>Who has signed</h2>
          <ul>
            {signers.map((person) => (
              <li key={person.id}>
                <span className="sign-page-signer-name">{person.name}</span>
                <span className={person.signed_at ? 'sign-page-signer-done' : 'sign-page-signer-waiting'}>
                  {person.signed_at ? 'Signed' : 'Not signed'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!loading && !error ? (
        <PageDocumentView
          title={title}
          chunks={chunks}
          onChunkChange={signingComplete ? undefined : (next) => void handleChunkChange(next)}
        />
      ) : null}
    </main>
  )
}
