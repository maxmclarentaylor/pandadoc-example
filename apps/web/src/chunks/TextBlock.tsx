import { useLayoutEffect, useRef } from 'react'
import type { ChunkChange, TextChunk } from './types'

type TextBlockProps = {
  chunk: TextChunk
  onChange: ChunkChange
}

export default function TextBlock({ chunk, onChange }: TextBlockProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    element.style.height = '0px'
    element.style.height = `${element.scrollHeight}px`
  }, [chunk.text])

  return (
    <textarea
      ref={ref}
      value={chunk.text}
      rows={1}
      placeholder="Text"
      onChange={(event) => onChange({ ...chunk, text: event.target.value })}
    />
  )
}
