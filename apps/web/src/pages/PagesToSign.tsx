import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { fetchMe, fetchPagesToSign, type PageSummary } from '../api'
import { useAuth } from '../AuthContext'
import ListTabs from './ListTabs'
import './FileList.css'

export default function PagesToSign() {
  const navigate = useNavigate()
  const { ready, account, login, getAccessToken } = useAuth()
  const [pages, setPages] = useState<PageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) {
      return
    }

    let cancel = false

    async function loadPages() {
      setLoading(true)
      setError(null)
      try {
        if (!account) {
          await login()
        }
        await fetchMe(getAccessToken)
        const saved = await fetchPagesToSign(getAccessToken)
        if (!cancel) {
          setPages(saved)
        }
      } catch (err) {
        if (!cancel) {
          setError(err instanceof Error ? err.message : 'Could not load pages to sign')
        }
      } finally {
        if (!cancel) {
          setLoading(false)
        }
      }
    }

    void loadPages()
    return () => {
      cancel = true
    }
  }, [ready, account, login, getAccessToken])

  return (
    <main className="file-list">
      <header className="file-list-header">
        <h1>Pages to sign</h1>
      </header>
      <ListTabs active="sign" />
      <p className="file-list-status">
        Locked pages that have been marked as sent. Viewing only — no editing here.
      </p>
      {loading ? <p className="file-list-status">Loading pages…</p> : null}
      {error ? (
        <p className="file-list-error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && pages.length === 0 ? (
        <p className="file-list-status">
          No pages to sign yet. Lock a page, add assignees, then use Send for signature.
        </p>
      ) : null}
      {pages.length > 0 ? (
        <ul className="file-list-items">
          {pages.map((page) => (
            <li key={page.id}>
              <button
                type="button"
                className="file-list-item"
                onClick={() => navigate(`/pages-to-sign/${page.id}`)}
              >
                <span className="file-list-title">{page.title}</span>
                {page.signing_complete ? <span className="file-list-signed">Document already signed</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  )
}
