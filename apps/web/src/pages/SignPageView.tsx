import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { fetchMe, fetchPage } from '../api'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <main className="sign-page">
      <header className="sign-page-header">
        <button type="button" className="sign-page-back" onClick={() => navigate('/pages-to-sign')}>
          Pages to sign
        </button>
        <p className="sign-page-note">Signature and date fields only</p>
      </header>
      {loading ? <p className="sign-page-status">Loading…</p> : null}
      {error ? (
        <p className="sign-page-error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error ? (
        <PageDocumentView
          title={title}
          chunks={chunks}
          onChunkChange={(next) => {
            setChunks((current) => current.map((chunk) => (chunk.id === next.id ? next : chunk)))
          }}
        />
      ) : null}
    </main>
  )
}
