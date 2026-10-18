import * as Y from 'yjs'
import type { Chunk, ChunkType } from './chunks/types'

/** Marks edits that started in this browser, so we do not apply them twice. */
export const LOCAL = 'local'

export function readPage(doc: Y.Doc): { title: string; chunks: Chunk[] } {
  const chunks = doc.getArray<Y.Map<unknown>>('chunks')
  return {
    title: doc.getText('title').toString(),
    chunks: chunks.toArray().map(readChunk),
  }
}

export function writePage(doc: Y.Doc, title: string, chunks: Chunk[]) {
  doc.transact(() => {
    applyString(doc.getText('title'), title)
    syncChunks(doc.getArray<Y.Map<unknown>>('chunks'), chunks)
  }, LOCAL)
}

function readChunk(map: Y.Map<unknown>): Chunk {
  const id = String(map.get('id') ?? '')
  const type = String(map.get('type') ?? 'text') as ChunkType
  if (type === 'image') {
    return { id, type, src: String(map.get('src') ?? ''), alt: String(map.get('alt') ?? '') }
  }
  if (type === 'video') {
    return { id, type, url: String(map.get('url') ?? '') }
  }
  if (type === 'signature') {
    return { id, type, dataUrl: String(map.get('dataUrl') ?? '') }
  }
  if (type === 'date') {
    return { id, type, value: String(map.get('value') ?? '') }
  }
  if (type === 'table') {
    return {
      id,
      type,
      columns: readTextList(map.get('columns')),
      rows: readTextRows(map.get('rows')),
    }
  }
  const text = map.get('text')
  return { id, type: 'text', text: text instanceof Y.Text ? text.toString() : String(text ?? '') }
}

function readTextList(value: unknown): string[] {
  if (!(value instanceof Y.Array)) {
    return []
  }
  return value.toArray().map((item) => (item instanceof Y.Text ? item.toString() : String(item ?? '')))
}

function readTextRows(value: unknown): string[][] {
  if (!(value instanceof Y.Array)) {
    return []
  }
  return value.toArray().map((row) => readTextList(row))
}

function applyString(ytext: Y.Text, next: string) {
  const prev = ytext.toString()
  if (prev === next) {
    return
  }
  let start = 0
  while (start < prev.length && start < next.length && prev[start] === next[start]) {
    start += 1
  }
  let endPrev = prev.length
  let endNext = next.length
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev -= 1
    endNext -= 1
  }
  if (endPrev > start) {
    ytext.delete(start, endPrev - start)
  }
  if (endNext > start) {
    ytext.insert(start, next.slice(start, endNext))
  }
}

function syncChunks(yChunks: Y.Array<Y.Map<unknown>>, chunks: Chunk[]) {
  const keep = new Set(chunks.map((chunk) => chunk.id))
  for (let index = yChunks.length - 1; index >= 0; index -= 1) {
    const id = String(yChunks.get(index).get('id') ?? '')
    if (!keep.has(id)) {
      yChunks.delete(index, 1)
    }
  }

  chunks.forEach((chunk, index) => {
    const current = yChunks.toArray()
    const found = current.findIndex((item) => item.get('id') === chunk.id)
    if (found === -1) {
      yChunks.insert(index, [chunkToMap(chunk)])
      return
    }
    if (found !== index) {
      const item = current[found]
      yChunks.delete(found, 1)
      yChunks.insert(index, [item])
    }
    writeChunk(yChunks.get(index), chunk)
  })
}

function chunkToMap(chunk: Chunk): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  map.set('id', chunk.id)
  map.set('type', chunk.type)
  if (chunk.type === 'text') {
    map.set('text', new Y.Text(chunk.text))
  } else if (chunk.type === 'image') {
    map.set('src', chunk.src)
    map.set('alt', chunk.alt)
  } else if (chunk.type === 'video') {
    map.set('url', chunk.url)
  } else if (chunk.type === 'signature') {
    map.set('dataUrl', chunk.dataUrl)
  } else if (chunk.type === 'date') {
    map.set('value', chunk.value)
  } else {
    const columns = new Y.Array<Y.Text>()
    columns.push(chunk.columns.map((column) => new Y.Text(column)))
    const rows = new Y.Array<Y.Array<Y.Text>>()
    chunk.rows.forEach((row) => {
      const cells = new Y.Array<Y.Text>()
      cells.push(row.map((cell) => new Y.Text(cell)))
      rows.push([cells])
    })
    map.set('columns', columns)
    map.set('rows', rows)
  }
  return map
}

function writeChunk(map: Y.Map<unknown>, chunk: Chunk) {
  if (map.get('type') !== chunk.type) {
    map.set('type', chunk.type)
  }
  if (chunk.type === 'text') {
    writeTextField(map, 'text', chunk.text)
  } else if (chunk.type === 'image') {
    writeScalar(map, 'src', chunk.src)
    writeScalar(map, 'alt', chunk.alt)
  } else if (chunk.type === 'video') {
    writeScalar(map, 'url', chunk.url)
  } else if (chunk.type === 'signature') {
    writeScalar(map, 'dataUrl', chunk.dataUrl)
  } else if (chunk.type === 'date') {
    writeScalar(map, 'value', chunk.value)
  } else if (chunk.type === 'table') {
    const columns = textArray(map, 'columns')
    syncTextArray(columns, chunk.columns)
    const rows = map.get('rows')
    const rowArray = rows instanceof Y.Array ? rows : new Y.Array<Y.Array<Y.Text>>()
    if (!(rows instanceof Y.Array)) {
      map.set('rows', rowArray)
    }
    syncRows(rowArray, chunk.rows)
  }
}

function writeScalar(map: Y.Map<unknown>, key: string, value: string) {
  if (map.get(key) !== value) {
    map.set(key, value)
  }
}

function writeTextField(map: Y.Map<unknown>, key: string, value: string) {
  const current = map.get(key)
  if (!(current instanceof Y.Text)) {
    map.set(key, new Y.Text(value))
    return
  }
  applyString(current, value)
}

function textArray(map: Y.Map<unknown>, key: string): Y.Array<Y.Text> {
  const current = map.get(key)
  if (current instanceof Y.Array) {
    return current
  }
  const created = new Y.Array<Y.Text>()
  map.set(key, created)
  return created
}

function syncTextArray(array: Y.Array<Y.Text>, values: string[]) {
  while (array.length > values.length) {
    array.delete(array.length - 1, 1)
  }
  values.forEach((value, index) => {
    if (index >= array.length) {
      array.insert(index, [new Y.Text(value)])
      return
    }
    const cell = array.get(index)
    if (cell instanceof Y.Text) {
      applyString(cell, value)
    }
  })
}

function syncRows(rows: Y.Array<Y.Array<Y.Text>>, values: string[][]) {
  while (rows.length > values.length) {
    rows.delete(rows.length - 1, 1)
  }
  values.forEach((row, index) => {
    if (index >= rows.length) {
      const cells = new Y.Array<Y.Text>()
      cells.push(row.map((cell) => new Y.Text(cell)))
      rows.insert(index, [cells])
      return
    }
    syncTextArray(rows.get(index), row)
  })
}
