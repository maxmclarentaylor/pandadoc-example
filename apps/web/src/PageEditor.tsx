import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { createPage, pageCollabUrl } from './api'
import { useAuth } from './AuthContext'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, PenLine, Settings, Type } from 'lucide-react'
import AddChunkButton from './AddChunkButton'
import BlockMenu from './BlockMenu'
import PaletteChip from './PaletteChip'
import DateBlock from './chunks/DateBlock'
import ImageBlock from './chunks/ImageBlock'
import SignatureBlock from './chunks/SignatureBlock'
import TableBlock from './chunks/TableBlock'
import TextBlock from './chunks/TextBlock'
import VideoBlock from './chunks/VideoBlock'
import type { Chunk, ChunkChange, ChunkType } from './chunks/types'
import { LOCAL, readPage, writePage } from './collabDoc'
import { STARTING_CHUNKS } from './pages/salesContract'
import './PageEditor.css'

const NEW_TEXT_FIELD_ID = 'new-text-field'
const NEW_SIGNATURE_ID = 'new-signature'
const NEW_DATE_ID = 'new-date'
const PAGE_END = 'page-end'

const PALETTE_TYPES: Record<string, ChunkType> = {
  [NEW_TEXT_FIELD_ID]: 'text',
  [NEW_SIGNATURE_ID]: 'signature',
  [NEW_DATE_ID]: 'date',
}

const DEFAULT_TITLE = 'Untitled'

export default function PageEditor() {
  const { pageId } = useParams()
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [chunks, setChunks] = useState<Chunk[]>(() => (pageId ? [] : STARTING_CHUNKS))
  const [ready, setReady] = useState(!pageId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const docRef = useRef<Y.Doc | null>(null)
  const remoteEdit = useRef(false)
  const [pickerAfterId, setPickerAfterId] = useState<string | null>(null)
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null)
  const [cogMenuId, setCogMenuId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!pageId) {
      setTitle(DEFAULT_TITLE)
      setChunks(STARTING_CHUNKS)
      setLoadError(null)
      setReady(true)
      setLive(false)
      return
    }

    let cancel = false
    const doc = new Y.Doc()
    docRef.current = doc
    setReady(false)
    setLive(false)
    setLoadError(null)

    const id = pageId
    let provider: WebsocketProvider | null = null

    function publish() {
      if (cancel) {
        return
      }
      const page = readPage(doc)
      remoteEdit.current = true
      setTitle(page.title)
      setChunks(page.chunks)
      setReady(true)
      setLive(true)
    }

    doc.on('update', (_update, origin) => {
      if (origin === LOCAL || !provider?.synced) {
        return
      }
      publish()
    })

    async function connect() {
      const token = await getAccessToken()
      if (cancel) {
        return
      }
      const { serverUrl, room } = pageCollabUrl(id)
      provider = new WebsocketProvider(serverUrl, room, doc, {
        connect: true,
        params: { token },
        shouldReconnect: (event) => event.code !== 1008 && event.code !== 1011,
      })
      provider.on('sync', (synced: boolean) => {
        if (synced) {
          publish()
        }
      })
      provider.on('connection-close', (event: CloseEvent | null) => {
        if (cancel || (event?.code !== 1008 && event?.code !== 1011)) {
          return
        }
        setLoadError(
          event?.code === 1011
            ? 'Collaboration needs the API on Python 3.10 or newer'
            : 'Could not open this page',
        )
        setReady(false)
        setLive(false)
      })
    }

    connect().catch((err: unknown) => {
      if (cancel) {
        return
      }
      setLoadError(err instanceof Error ? err.message : 'Could not open this page')
    })

    return () => {
      cancel = true
      provider?.destroy()
      doc.destroy()
      docRef.current = null
    }
  }, [pageId, getAccessToken])

  useEffect(() => {
    if (!live) {
      return
    }
    const doc = docRef.current
    if (!doc) {
      return
    }
    if (remoteEdit.current) {
      remoteEdit.current = false
      return
    }
    writePage(doc, title, chunks)
  }, [live, title, chunks])

  async function savePage() {
    if (pageId) {
      return
    }
    setSaving(true)
    setSaveError(null)
    const body = { title: title.trim() || DEFAULT_TITLE, chunks }
    try {
      const created = await createPage(body, getAccessToken)
      setTitle(created.title)
      navigate(`/pages/${created.id}`, { replace: true })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this page')
    } finally {
      setSaving(false)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const paletteType = PALETTE_TYPES[String(active.id)]
    if (paletteType) {
      setChunks((current) => {
        const overIndex = current.findIndex((chunk) => chunk.id === over.id)
        if (overIndex === -1) {
          return current
        }
        const added = [...current, blankChunk(paletteType)]
        return arrayMove(added, added.length - 1, overIndex)
      })
      return
    }

    setChunks((current) => {
      const oldIndex = current.findIndex((chunk) => chunk.id === active.id)
      const newIndex = current.findIndex((chunk) => chunk.id === over.id)
      if (oldIndex === -1 || newIndex === -1) {
        return current
      }
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  function updateChunk(next: Chunk) {
    setChunks((current) => current.map((chunk) => (chunk.id === next.id ? next : chunk)))
  }

  function togglePicker(afterId: string) {
    setPickerAfterId((current) => (current === afterId ? null : afterId))
  }

  function addChunk(type: ChunkType) {
    setChunks((current) => {
      const added = [...current, blankChunk(type)]
      if (!pickerAfterId || pickerAfterId === PAGE_END) {
        return added
      }
      const index = current.findIndex((chunk) => chunk.id === pickerAfterId)
      if (index === -1) {
        return added
      }
      return arrayMove(added, added.length - 1, index + 1)
    })
    setPickerAfterId(null)
  }

  function selectChunk(id: string | null) {
    setSelectedChunkId(id)
    if (id === null) {
      setCogMenuId(null)
    }
  }

  function deleteChunk(id: string) {
    setChunks((current) => current.filter((chunk) => chunk.id !== id))
    setSelectedChunkId(null)
    setCogMenuId(null)
  }

  useEffect(() => {
    if (!pickerAfterId && !cogMenuId) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      if (target.closest('.chunk-picker, .add-chunk, .block-menu, .chunk-cog')) {
        return
      }
      setPickerAfterId(null)
      setCogMenuId(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [pickerAfterId, cogMenuId])

  return (
    <div className="workspace">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="editor-shell">
          <div className="editor-main">
            <div className="page-heading">
              <button type="button" className="page-back" onClick={() => navigate('/')}>
                Pages
              </button>
              <input
                className="page-title"
                aria-label="Page title"
                value={title}
                disabled={Boolean(pageId) && !ready}
                onChange={(event) => setTitle(event.target.value)}
              />
              <button
                type="button"
                className="page-save"
                onClick={() => void savePage()}
                disabled={!ready || saving || Boolean(pageId)}
              >
                {pageId ? (live ? 'Live' : 'Connecting') : saving ? 'Saving' : 'Save'}
              </button>
            </div>
            {loadError ? <p className="page-message page-message-error">{loadError}</p> : null}
            {pageId && !ready && !loadError ? <p className="page-message">Connecting…</p> : null}
            {saveError ? <p className="page-message page-message-error">{saveError}</p> : null}
            {!pageId || ready ? (
              <>
            <p className="workspace-note">Drag a block by its handle, or drag Text field onto a block.</p>
            <article className="doc-page">
              <SortableContext items={chunks.map((chunk) => chunk.id)} strategy={verticalListSortingStrategy}>
                <ul className="chunk-list">
                  {chunks.map((chunk) => (
                    <ChunkBlock
                      key={chunk.id}
                      chunk={chunk}
                      selected={selectedChunkId === chunk.id}
                      menuOpen={cogMenuId === chunk.id}
                      addOpen={pickerAfterId === chunk.id}
                      onChange={updateChunk}
                      onSelect={selectChunk}
                      onToggleMenu={() => setCogMenuId((current) => (current === chunk.id ? null : chunk.id))}
                      onDelete={() => deleteChunk(chunk.id)}
                      onToggleAdd={() => togglePicker(chunk.id)}
                      onAdd={addChunk}
                      onCloseAdd={() => setPickerAfterId(null)}
                    />
                  ))}
                </ul>
              </SortableContext>
              <AddChunkButton
                open={pickerAfterId === PAGE_END}
                onToggle={() => togglePicker(PAGE_END)}
                onAdd={addChunk}
                onClose={() => setPickerAfterId(null)}
              />
            </article>
              </>
            ) : null}
          </div>
          <aside className="field-rail">
            <h2>Add fillable fields</h2>
            <div className="field-list">
              <PaletteChip id={NEW_TEXT_FIELD_ID} label="Text field" icon={Type} />
              <PaletteChip id={NEW_SIGNATURE_ID} label="Signature" icon={PenLine} />
              <PaletteChip id={NEW_DATE_ID} label="Date" icon={Calendar} />
            </div>
          </aside>
        </div>
      </DndContext>
    </div>
  )
}

function blankChunk(type: ChunkType): Chunk {
  const id = crypto.randomUUID()
  if (type === 'text') {
    return { id, type, text: '' }
  }
  if (type === 'image') {
    return { id, type, src: '', alt: '' }
  }
  if (type === 'video') {
    return { id, type, url: '' }
  }
  if (type === 'signature') {
    return { id, type, dataUrl: '' }
  }
  if (type === 'date') {
    return { id, type, value: '' }
  }
  return {
    id,
    type,
    columns: ['Column 1', 'Column 2'],
    rows: [
      ['', ''],
      ['', ''],
    ],
  }
}

type ChunkBlockProps = {
  chunk: Chunk
  selected: boolean
  menuOpen: boolean
  addOpen: boolean
  onChange: ChunkChange
  onSelect: (id: string | null) => void
  onToggleMenu: () => void
  onDelete: () => void
  onToggleAdd: () => void
  onAdd: (type: ChunkType) => void
  onCloseAdd: () => void
}

function ChunkBlock({
  chunk,
  selected,
  menuOpen,
  addOpen,
  onChange,
  onSelect,
  onToggleMenu,
  onDelete,
  onToggleAdd,
  onAdd,
  onCloseAdd,
}: ChunkBlockProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: chunk.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  function handleBlur(event: FocusEvent<HTMLLIElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return
    }
    onSelect(null)
  }

  const className = isDragging ? 'chunk dragging' : selected ? 'chunk selected' : 'chunk'

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={className}
      onFocus={() => onSelect(chunk.id)}
      onBlur={handleBlur}
    >
      <button
        type="button"
        className="chunk-handle"
        aria-label="Drag to reorder"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
      >
        ::
      </button>
      <div className="chunk-body" tabIndex={-1}>
        {chunk.type === 'text' ? <TextBlock chunk={chunk} onChange={onChange} /> : null}
        {chunk.type === 'image' ? <ImageBlock chunk={chunk} onChange={onChange} /> : null}
        {chunk.type === 'video' ? <VideoBlock chunk={chunk} onChange={onChange} /> : null}
        {chunk.type === 'table' ? <TableBlock chunk={chunk} onChange={onChange} /> : null}
        {chunk.type === 'signature' ? (
          <SignatureBlock chunk={chunk} onChange={onChange} onPress={() => onSelect(chunk.id)} />
        ) : null}
        {chunk.type === 'date' ? (
          <DateBlock chunk={chunk} onChange={onChange} onPress={() => onSelect(chunk.id)} />
        ) : null}
        {selected ? (
          <button type="button" className="chunk-cog" aria-label="Block settings" aria-expanded={menuOpen} onClick={onToggleMenu}>
            <Settings aria-hidden strokeWidth={1.75} />
          </button>
        ) : null}
        {menuOpen ? <BlockMenu onDelete={onDelete} /> : null}
      </div>
      <AddChunkButton
        open={addOpen}
        onToggle={onToggleAdd}
        onAdd={onAdd}
        onClose={onCloseAdd}
      />
    </li>
  )
}
