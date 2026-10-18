import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { fetchMe, fetchPages, type PageSummary } from '../api'
import { useAuth } from '../AuthContext'
import './FileList.css'

export default function FileList() {
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
        const saved = await fetchPages(getAccessToken)
        if (!cancel) {
          setPages(saved)
        }
      } catch (err) {
        if (!cancel) {
          setError(err instanceof Error ? err.message : 'Could not load pages')
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
        <h1>Pages</h1>
        <button type="button" className="file-list-create" onClick={() => navigate('/pages/new')}>
          New page
        </button>
      </header>
      {loading ? <p className="file-list-status">Loading pages…</p> : null}
      {error ? (
        <p className="file-list-error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && pages.length === 0 ? (
        <p className="file-list-status">No pages yet. Create one to start a document.</p>
      ) : null}
      {pages.length > 0 ? (
        <ul className="file-list-items">
          {pages.map((page) => (
            <li key={page.id}>
              <button type="button" className="file-list-item" onClick={() => navigate(`/pages/${page.id}`)}>
                {page.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  )
}
