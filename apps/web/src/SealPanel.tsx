import type { SealCheck } from './api'
import './SealPanel.css'

type SealPanelProps = {
  check: SealCheck | null
  busy: boolean
  error: string | null
  onDownload?: () => void
  downloading?: boolean
}

function formatSealedAt(value: string | null): string {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
}

export default function SealPanel({ check, busy, error, onDownload, downloading }: SealPanelProps) {
  return (
    <div className="seal-panel" role="status">
      <p className="seal-panel-title">This page has been sealed. The final PDF carries a digital signature.</p>
      {onDownload ? (
        <button type="button" className="seal-panel-download" onClick={onDownload} disabled={downloading}>
          {downloading ? 'Preparing PDF…' : 'Download PDF'}
        </button>
      ) : null}
      {busy ? <p className="seal-panel-status">Checking the seal…</p> : null}
      {error ? (
        <p className="seal-panel-error" role="alert">
          {error}
        </p>
      ) : null}
      {check ? (
        <>
          <p className="seal-panel-result">
            {check.intact ? 'Signature intact.' : 'The signature does not match this PDF.'}
            {check.field_name ? ` Field ${check.field_name}.` : ''}
            {check.certificate_name ? ` Certificate ${check.certificate_name}.` : ''}
            {check.sealed_at ? ` Sealed ${formatSealedAt(check.sealed_at)}.` : ''}
          </p>
          {check.self_signed ? (
            <p className="seal-panel-note">
              This certificate is self-signed for the demo, so Acrobat will confirm the file is unchanged and
              will not treat the name as publicly trusted.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
