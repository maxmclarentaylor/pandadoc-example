import { useEffect, useId, useRef, useState } from 'react'
import SignaturePad from 'react-signature-pad-wrapper'
import type { ChunkChange, SignatureChunk } from './types'

type SignatureBlockProps = {
  chunk: SignatureChunk
  onChange: ChunkChange
  onPress: () => void
  readOnly?: boolean
}

const PEN_COLORS = [
  { name: 'Black', value: '#1c1c1c' },
  { name: 'Blue', value: '#2f6fed' },
  { name: 'Red', value: '#e11d48' },
]

const PREVIEW_WIDTH = 138
const PREVIEW_HEIGHT = 45

export default function SignatureBlock({ chunk, onChange, onPress, readOnly = false }: SignatureBlockProps) {
  const padRef = useRef<SignaturePad>(null)
  const modalPadRef = useRef<SignaturePad>(null)
  const savedPadRef = useRef<SignaturePad>(null)
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'draw' | 'saved'>('draw')
  const [dataUrl, setDataUrl] = useState(chunk.dataUrl)
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value)

  useEffect(() => {
    if (readOnly) {
      setOpen(false)
    }
  }, [readOnly])

  useEffect(() => {
    const pad = padRef.current
    if (!pad) {
      return
    }
    pad.off()
    if (dataUrl) {
      pad.fromDataURL(dataUrl)
    } else {
      pad.clear()
    }
  }, [dataUrl])

  useEffect(() => {
    if (!open) {
      return
    }
    const pad = savedPadRef.current
    if (!pad) {
      return
    }
    pad.off()
    if (dataUrl) {
      pad.fromDataURL(dataUrl)
    } else {
      pad.clear()
    }
  }, [open, dataUrl, tab])

  function acceptAndSign() {
    const pad = tab === 'draw' ? modalPadRef.current : savedPadRef.current
    if (!pad) {
      return
    }
    const next = pad.toDataURL()
    setDataUrl(next)
    onChange({ ...chunk, dataUrl: next })
    setOpen(false)
  }

  function clearDrawing() {
    modalPadRef.current?.clear()
  }

  function chooseColor(color: string) {
    setPenColor(color)
    if (modalPadRef.current) {
      modalPadRef.current.penColor = color
    }
  }

  function openModal() {
    if (readOnly) {
      return
    }
    setPenColor(PEN_COLORS[0].value)
    setOpen(true)
  }

  return (
    <div className="signature-block" onPointerDown={onPress}>
      <button type="button" className="signature-preview" disabled={readOnly} onClick={openModal}>
        <SignaturePad
          ref={padRef}
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          options={{ penColor: '#1c1c1c' }}
        />
        {dataUrl ? null : (
          <span className="signature-placeholder">
            <svg className="signature-mark" viewBox="0 0 18 17" aria-hidden>
              <path
                d="M2.2 3.2l.7 1.2.8-1.4.7 1.4.8-1.2M3 13.2c1.2-3.4 2-5.2 2.6-5.2.7 0 .6 3.6 1.8 3.6s1.1-6.2 2.4-6.2 1.2 5.4 2.2 5.4 1-2.4 2.6-2.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Signature
          </span>
        )}
      </button>
      {open ? (
        <div className="signature-backdrop" onClick={() => setOpen(false)}>
          <div
            className="signature-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="signature-modal-header">
              <h2 id={titleId}>Signature</h2>
              <button type="button" className="signature-close" aria-label="Close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <div className="signature-tabs" role="tablist">
              <button
                type="button"
                className="signature-tab"
                role="tab"
                aria-selected={tab === 'draw'}
                onClick={() => setTab('draw')}
              >
                Draw
              </button>
              <button
                type="button"
                className="signature-tab"
                role="tab"
                aria-selected={tab === 'saved'}
                onClick={() => setTab('saved')}
              >
                My Signature
              </button>
            </div>
            {tab === 'draw' ? (
              <div className="signature-draw">
                <div className="signature-draw-bar">
                  <button type="button" className="signature-clear" onClick={clearDrawing}>
                    Clear
                  </button>
                  <div className="signature-colors">
                    {PEN_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className="signature-color"
                        style={{ background: color.value }}
                        aria-label={color.name}
                        aria-pressed={penColor === color.value}
                        onClick={() => chooseColor(color.value)}
                      />
                    ))}
                  </div>
                </div>
                <SignaturePad ref={modalPadRef} options={{ penColor }} />
                <div className="signature-baseline" />
              </div>
            ) : (
              <div className="signature-draw signature-saved">
                <SignaturePad ref={savedPadRef} options={{ penColor: '#1c1c1c' }} />
                <div className="signature-baseline" />
              </div>
            )}
            <p className="signature-legal">
              By electronically signing this document, I agree that my signature and initials are the equivalent of my
              handwritten signature and are considered originals on all documents, including legally binding contracts. I
              also agree to the{' '}
              <a href="#master-services-agreement" onClick={(event) => event.preventDefault()}>
                Master Services Agreement
              </a>{' '}
              and{' '}
              <a href="#privacy-policy" onClick={(event) => event.preventDefault()}>
                Privacy Policy
              </a>.
            </p>
            <div className="signature-actions">
              <button type="button" className="signature-cancel" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="signature-accept" onClick={acceptAndSign}>
                Accept and sign
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
