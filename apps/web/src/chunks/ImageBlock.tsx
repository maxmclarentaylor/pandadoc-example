import type { ChunkChange, ImageChunk } from './types'

type ImageBlockProps = {
  chunk: ImageChunk
  onChange: ChunkChange
  readOnly?: boolean
}

export default function ImageBlock({ chunk, onChange, readOnly = false }: ImageBlockProps) {
  return (
    <div className="media-block">
      {chunk.src ? (
        <img src={chunk.src} alt={chunk.alt} />
      ) : (
        <div className="media-placeholder">Image</div>
      )}
      {readOnly ? null : (
        <>
          <label>
            Image address
            <input
              value={chunk.src}
              placeholder="https://example.com/photo.jpg"
              onChange={(event) => onChange({ ...chunk, src: event.target.value })}
            />
          </label>
          <label>
            Description
            <input
              value={chunk.alt}
              placeholder="What the image shows"
              onChange={(event) => onChange({ ...chunk, alt: event.target.value })}
            />
          </label>
        </>
      )}
    </div>
  )
}
