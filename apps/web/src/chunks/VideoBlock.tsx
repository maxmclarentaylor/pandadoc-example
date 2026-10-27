import type { ChunkChange, VideoChunk } from './types'

type VideoBlockProps = {
  chunk: VideoChunk
  onChange: ChunkChange
  readOnly?: boolean
}

export default function VideoBlock({ chunk, onChange, readOnly = false }: VideoBlockProps) {
  const embedUrl = embedVideoUrl(chunk.url)

  return (
    <div className="media-block">
      {embedUrl ? (
        <iframe src={embedUrl} title="Video" allow="fullscreen" />
      ) : chunk.url ? (
        <video src={chunk.url} controls />
      ) : (
        <div className="media-placeholder">Video</div>
      )}
      {readOnly ? null : (
        <label>
          Video address
          <input
            value={chunk.url}
            placeholder="YouTube, Vimeo, or a video file link"
            onChange={(event) => onChange({ ...chunk, url: event.target.value })}
          />
        </label>
      )}
    </div>
  )
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
