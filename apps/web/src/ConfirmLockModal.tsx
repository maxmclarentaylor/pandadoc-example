import { useId } from 'react'

type ConfirmLockModalProps = {
  open: boolean
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function ConfirmLockModal({ open, busy, onClose, onConfirm }: ConfirmLockModalProps) {
  const titleId = useId()

  if (!open) {
    return null
  }

  return (
    <div className="lock-confirm-backdrop" onClick={() => (busy ? undefined : onClose())}>
      <div
        className="lock-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>Lock this page?</h2>
        <p>
          Once locked, the page can’t be edited or unlocked from the editor. A fingerprint of the current
          content will be stored, and a PDF snapshot will be generated for download.
        </p>
        <div className="lock-confirm-actions">
          <button type="button" className="lock-confirm-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="lock-confirm-confirm" onClick={onConfirm} disabled={busy}>
            {busy ? 'Locking…' : 'Confirm lock'}
          </button>
        </div>
      </div>
    </div>
  )
}
