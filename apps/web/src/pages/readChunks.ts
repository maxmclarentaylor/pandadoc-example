import type { Chunk } from '../chunks/types'

/** Turn API JSON chunk blobs into the Chunk union used by the viewer. */
export function readChunks(raw: unknown): Chunk[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.map((item, index) => readChunk(item, index))
}

function readChunk(raw: unknown, index: number): Chunk {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const id = typeof row.id === 'string' && row.id ? row.id : `chunk-${index}`
  const type = typeof row.type === 'string' ? row.type : 'text'

  if (type === 'image') {
    return {
      id,
      type: 'image',
      src: stringField(row.src),
      alt: stringField(row.alt),
    }
  }
  if (type === 'video') {
    return { id, type: 'video', url: stringField(row.url) }
  }
  if (type === 'signature') {
    return { id, type: 'signature', dataUrl: stringField(row.dataUrl) }
  }
  if (type === 'date') {
    return { id, type: 'date', value: stringField(row.value) }
  }
  if (type === 'table') {
    return {
      id,
      type: 'table',
      columns: stringList(row.columns),
      rows: stringRows(row.rows),
    }
  }
  return { id, type: 'text', text: stringField(row.text) }
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((item) => stringField(item))
}

function stringRows(value: unknown): string[][] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((row) => stringList(row))
}
