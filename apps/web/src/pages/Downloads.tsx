import { useEffect, useState } from 'react'
import { downloadPagePdf, fetchMe, fetchPages, type PageSummary } from '../api'
import { useAuth } from '../AuthContext'
import ListTabs from './ListTabs'
import './FileList.css'

function pdfFilename(title: string): string {
  const safe = (title.trim() || 'page').replace(/[^\w.\-]+/g, '_').slice(0, 80)
  return `${safe || 'page'}.pdf`
}

export default function Downloads() {
  const { ready, account, login, getAccessToken } = useAuth()
  const [pages, setPages] = useState<PageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

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
          setError(err instanceof Error ? err.message : 'Could not load documents')
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

  async function handleDownload(page: PageSummary) {
    if (!page.signing_complete) {
      return
    }
    setDownloadingId(page.id)
    setError(null)
    try {
      await downloadPagePdf(page.id, getAccessToken, pdfFilename(page.title))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <main className="file-list">
      <header className="file-list-header">
        <h1>Downloads</h1>
      </header>
      <ListTabs active="downloads" />
      {loading ? <p className="file-list-status">Loading documents…</p> : null}
      {error ? (
        <p className="file-list-error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && pages.length === 0 ? (
        <p className="file-list-status">No documents yet.</p>
      ) : null}
      {pages.length > 0 ? (
        <ul className="file-list-items">
          {pages.map((page) => (
            <li key={page.id} className="file-list-row">
              <div className="file-list-item file-list-item-static">
                <span className="file-list-title">{page.title}</span>
              </div>
              <span
                className="file-list-download-wrap"
                title={
                  page.signing_complete ? undefined : 'You can only download when everyone has signed'
                }
              >
                <button
                  type="button"
                  className="file-list-download"
                  disabled={!page.signing_complete || downloadingId === page.id}
                  onClick={() => void handleDownload(page)}
                >
                  {downloadingId === page.id ? 'Preparing PDF…' : 'Download PDF'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  )
}
