import { useNavigate } from 'react-router'

type ListTab = 'documents' | 'sign' | 'downloads'

const TABS: { id: ListTab; label: string; path: string }[] = [
  { id: 'documents', label: 'Documents', path: '/' },
  { id: 'sign', label: 'Pages to sign', path: '/pages-to-sign' },
  { id: 'downloads', label: 'Downloads', path: '/downloads' },
]

export default function ListTabs({ active }: { active: ListTab }) {
  const navigate = useNavigate()

  return (
    <nav className="file-list-tabs" aria-label="Sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === active ? 'file-list-tab file-list-tab-active' : 'file-list-tab'}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => navigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
