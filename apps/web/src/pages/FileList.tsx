import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Trash2 } from 'lucide-react'
import { deletePage, fetchMe, fetchPages, type PageSummary } from '../api'
import { useAuth } from '../AuthContext'
import ListTabs from './ListTabs'
import './FileList.css'

export default function FileList() {
  const navigate = useNavigate()
  const { ready, account, login, getAccessToken } = useAuth()
  const [pages, setPages] = useState<PageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  async function handleDelete(page: PageSummary) {
    setDeletingId(page.id)
    setError(null)
    try {
      await deletePage(page.id, getAccessToken)
      setPages((current) => current.filter((item) => item.id !== page.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete page')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="file-list">
      <header className="file-list-header">
        <h1>Documents</h1>
        <button type="button" className="file-list-create" onClick={() => navigate('/pages/new')}>
          New page
        </button>
      </header>
      <ListTabs active="documents" />
      {loading ? <p className="file-list-status">Loading documents…</p> : null}
      {error ? (
        <p className="file-list-error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && pages.length === 0 ? (
        <p className="file-list-status">No documents yet. Create one to start.</p>
      ) : null}
      {pages.length > 0 ? (
        <ul className="file-list-items">
          {pages.map((page) => (
            <li key={page.id} className="file-list-row">
              <button type="button" className="file-list-item" onClick={() => navigate(`/pages/${page.id}`)}>
                <span className="file-list-title">{page.title}</span>
                {page.locked ? <span className="file-list-locked">Locked</span> : null}
              </button>
              <button
                type="button"
                className="file-list-delete"
                aria-label={`Delete ${page.title}`}
                disabled={deletingId === page.id}
                onClick={() => void handleDelete(page)}
              >
                <Trash2 aria-hidden strokeWidth={1.75} size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  )
}
