import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { fetchMe, fetchPage, saveSigningFields } from '../api'
import { useAuth } from '../AuthContext'
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
  const [contentHash, setContentHash] = useState<string | null>(null)
  const [signingComplete, setSigningComplete] = useState(false)
  const [sealed, setSealed] = useState(false)
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
        setTitle(page.title)
        setChunks(readChunks(page.chunks))
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
        <p className="sign-page-sealed" role="status">
          This page has been sealed. The final PDF carries a digital signature.
        </p>
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
