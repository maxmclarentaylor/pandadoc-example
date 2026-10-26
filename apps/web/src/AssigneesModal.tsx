import { useEffect, useId, useState } from 'react'
import { DEMO_ENTRA_USERS, type AssigneeWrite, type PageAssignee } from './api'

type DraftAssignee = {
  key: string
  name: string
  email: string
  demo_entra_upn: string
}

type AssigneesModalProps = {
  open: boolean
  initial: PageAssignee[]
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (assignees: AssigneeWrite[]) => void
}

function blankRow(): DraftAssignee {
  return { key: crypto.randomUUID(), name: '', email: '', demo_entra_upn: '' }
}

function toDraft(rows: PageAssignee[]): DraftAssignee[] {
  if (rows.length === 0) {
    return [blankRow()]
  }
  return rows.map((row) => ({
    key: row.id,
    name: row.name,
    email: row.email,
    demo_entra_upn: row.demo_entra_upn || '',
  }))
}

export default function AssigneesModal({
  open,
  initial,
  saving,
  error,
  onClose,
  onSave,
}: AssigneesModalProps) {
  const titleId = useId()
  const [rows, setRows] = useState<DraftAssignee[]>(() => toDraft(initial))

  useEffect(() => {
    if (open) {
      setRows(toDraft(initial))
    }
  }, [open, initial])

  if (!open) {
    return null
  }

  function updateRow(key: string, patch: Partial<DraftAssignee>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removeRow(key: string) {
    setRows((current) => {
      const next = current.filter((row) => row.key !== key)
      return next.length > 0 ? next : [blankRow()]
    })
  }

  function handleSave() {
    const assignees = rows
      .map((row) => ({
        name: row.name.trim(),
        email: row.email.trim(),
        demo_entra_upn: row.demo_entra_upn.trim(),
      }))
      .filter((row) => row.name || row.email || row.demo_entra_upn)
    onSave(assignees)
  }

  return (
    <div className="assignees-backdrop" onClick={onClose}>
      <div
        className="assignees-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="assignees-modal-header">
          <h2 id={titleId}>Assignees</h2>
          <button type="button" className="assignees-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="assignees-help">
          Add people who will sign this page. The personal email gets the invite; the demo login is who they sign in
          as.
        </p>
        <p className="assignees-demo-note">
          Demo only: because Entra logins and real inboxes are separate in this local setup, pick which demo user
          (Editor One / Editor Two) this invitee will use when signing. In production you would not ask for this —
          the signer’s authenticated identity would come from their own account.
        </p>
        <ul className="assignees-list">
          {rows.map((row, index) => (
            <li key={row.key} className="assignees-row">
              <label>
                <span>Name</span>
                <input
                  value={row.name}
                  placeholder={`Signer ${index + 1}`}
                  autoComplete="name"
                  onChange={(event) => updateRow(row.key, { name: event.target.value })}
                />
              </label>
              <label>
                <span>Email (real inbox)</span>
                <input
                  type="email"
                  value={row.email}
                  placeholder="name@example.com"
                  autoComplete="email"
                  onChange={(event) => updateRow(row.key, { email: event.target.value })}
                />
              </label>
              <label>
                <span>Demo Entra user</span>
                <select
                  value={row.demo_entra_upn}
                  onChange={(event) => updateRow(row.key, { demo_entra_upn: event.target.value })}
                >
                  <option value="">Select…</option>
                  {DEMO_ENTRA_USERS.map((user) => (
                    <option key={user.upn} value={user.upn}>
                      {user.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="assignees-remove" onClick={() => removeRow(row.key)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="assignees-add" onClick={() => setRows((current) => [...current, blankRow()])}>
          Add assignee
        </button>
        {error ? (
          <p className="assignees-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="assignees-actions">
          <button type="button" className="assignees-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="assignees-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
