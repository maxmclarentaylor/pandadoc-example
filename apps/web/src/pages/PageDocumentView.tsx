import DateBlock from '../chunks/DateBlock'
import SignatureBlock from '../chunks/SignatureBlock'
import type { Chunk, ChunkChange } from '../chunks/types'
import '../PageEditor.css'
import './PageDocumentView.css'

type PageDocumentViewProps = {
  title: string
  chunks: Chunk[]
  onChunkChange?: ChunkChange
}

export default function PageDocumentView({ title, chunks, onChunkChange }: PageDocumentViewProps) {
  return (
    <article className="sign-doc">
      <h1 className="sign-doc-title">{title}</h1>
      <ul className="sign-doc-chunks">
        {chunks.map((chunk) => (
          <li key={chunk.id} className="sign-doc-chunk">
            <SignChunk chunk={chunk} onChange={onChunkChange} />
          </li>
        ))}
      </ul>
    </article>
  )
}

function SignChunk({ chunk, onChange }: { chunk: Chunk; onChange?: ChunkChange }) {
  if (chunk.type === 'signature') {
    return (
      <SignatureBlock
        chunk={chunk}
        onChange={onChange ?? (() => undefined)}
        onPress={() => undefined}
        readOnly={!onChange}
      />
    )
  }
  if (chunk.type === 'date') {
    return (
      <DateBlock
        chunk={chunk}
        onChange={onChange ?? (() => undefined)}
        onPress={() => undefined}
        readOnly={!onChange}
      />
    )
  }
  if (chunk.type === 'text') {
    return <p className="sign-doc-text">{chunk.text || '—'}</p>
  }
  if (chunk.type === 'image') {
    return chunk.src ? (
      <img className="sign-doc-image" src={chunk.src} alt={chunk.alt || ''} />
    ) : (
      <p className="sign-doc-placeholder">Image</p>
    )
  }
  if (chunk.type === 'video') {
    const embedUrl = embedVideoUrl(chunk.url)
    if (embedUrl) {
      return <iframe className="sign-doc-video" src={embedUrl} title="Video" allow="fullscreen" />
    }
    if (chunk.url) {
      return <video className="sign-doc-video" src={chunk.url} controls />
    }
    return <p className="sign-doc-placeholder">Video</p>
  }
  if (chunk.type === 'table') {
    return (
      <table className="sign-doc-table">
        <thead>
          <tr>
            {chunk.columns.map((column, index) => (
              <th key={index}>{column || `Column ${index + 1}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chunk.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, columnIndex) => (
                <td key={columnIndex}>{cell || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  return null
}

function embedVideoUrl(url: string): string | null {
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (youtube) {
    return `https://www.youtube.com/embed/${youtube[1]}`
  }
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) {
    return `https://player.vimeo.com/embed/${vimeo[1]}`
  }
  return null
}
