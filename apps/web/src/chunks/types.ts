export type ChunkType = 'text' | 'image' | 'video' | 'table' | 'signature' | 'date'

export type TextChunk = {
  id: string
  type: 'text'
  text: string
}

export type ImageChunk = {
  id: string
  type: 'image'
  src: string
  alt: string
}

export type VideoChunk = {
  id: string
  type: 'video'
  url: string
}

export type TableChunk = {
  id: string
  type: 'table'
  columns: string[]
  rows: string[][]
}

export type SignatureChunk = {
  id: string
  type: 'signature'
  dataUrl: string
}

export type DateChunk = {
  id: string
  type: 'date'
  value: string
}

export type Chunk = TextChunk | ImageChunk | VideoChunk | TableChunk | SignatureChunk | DateChunk

export type ChunkChange = (next: Chunk) => void
