import { useEffect, useId, useState } from 'react'
import type { AssigneeWrite, PageAssignee } from './api'

type DraftAssignee = {
  key: string
  name: string
  email: string
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
  return { key: crypto.randomUUID(), name: '', email: '' }
}

function toDraft(rows: PageAssignee[]): DraftAssignee[] {
  if (rows.length === 0) {
    return [blankRow()]
  }
  return rows.map((row) => ({
    key: row.id,
    name: row.name,
    email: row.email,
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
      .map((row) => ({ name: row.name.trim(), email: row.email.trim() }))
      .filter((row) => row.name || row.email)
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
          Add people who will sign this page. Names and emails are saved now; nothing is emailed yet.
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
                <span>Email</span>
                <input
                  type="email"
                  value={row.email}
                  placeholder="name@example.com"
                  autoComplete="email"
                  onChange={(event) => updateRow(row.key, { email: event.target.value })}
                />
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
