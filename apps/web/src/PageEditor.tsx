import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import {
  createPage,
  fetchPage,
  lockPage,
  pageCollabUrl,
  unlockPage,
  verifyPageIntegrity,
} from './api'
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
import { LOCAL, readPage, writeLocked, writePage } from './collabDoc'
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
  const [locked, setLocked] = useState(false)
  const [contentHash, setContentHash] = useState<string | null>(null)
  const [lockBusy, setLockBusy] = useState(false)
  const [integrity, setIntegrity] = useState<'idle' | 'checking' | 'ok' | 'mismatch' | 'error'>('idle')
  const docRef = useRef<Y.Doc | null>(null)
  const remoteEdit = useRef(false)
  const lockedRef = useRef(false)
  const [pickerAfterId, setPickerAfterId] = useState<string | null>(null)
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null)
  const [cogMenuId, setCogMenuId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    lockedRef.current = locked
  }, [locked])

  useEffect(() => {
    if (!pageId) {
      setTitle(DEFAULT_TITLE)
      setChunks(STARTING_CHUNKS)
      setLocked(false)
      setContentHash(null)
      setIntegrity('idle')
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
    setLocked(false)
    setContentHash(null)
    setIntegrity('idle')
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
      if (lockedRef.current && !page.locked) {
        writeLocked(doc, true)
        setLocked(true)
      } else {
        setLocked(page.locked)
      }
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
      // Postgres is source of truth for lock; Yjs keeps collaborators in sync.
      try {
        const saved = await fetchPage(id, getAccessToken)
        if (!cancel) {
          lockedRef.current = saved.locked
          setLocked(saved.locked)
          setContentHash(saved.content_hash)
          setIntegrity('idle')
        }
      } catch {
        // Collab can still open; lock UI falls back to Yjs meta.
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
          if (lockedRef.current) {
            writeLocked(doc, true)
          }
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
    if (!live || locked) {
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
  }, [live, locked, title, chunks])

  async function setPageLocked(next: boolean) {
    setCogMenuId(null)
    setSelectedChunkId(null)
    setPickerAfterId(null)
    setSaveError(null)
    setIntegrity('idle')

    if (!pageId) {
      setSaveError('Save the page before locking so the hash can be stored in the database.')
      return
    }

    setLockBusy(true)
    try {
      if (next) {
        const lockedPage = await lockPage(
          pageId,
          { title: title.trim() || DEFAULT_TITLE, chunks },
          getAccessToken,
        )
        lockedRef.current = true
        setLocked(true)
        setContentHash(lockedPage.content_hash)
      } else {
        await unlockPage(pageId, getAccessToken)
        lockedRef.current = false
        setLocked(false)
        setContentHash(null)
      }
      const doc = docRef.current
      if (live && doc) {
        writeLocked(doc, next)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : next ? 'Could not lock page' : 'Could not unlock page')
    } finally {
      setLockBusy(false)
    }
  }

  async function checkIntegrity() {
    if (!pageId) {
      return
    }
    setIntegrity('checking')
    setSaveError(null)
    try {
      const result = await verifyPageIntegrity(pageId, getAccessToken)
      setContentHash(result.content_hash)
      setIntegrity(result.matches ? 'ok' : 'mismatch')
    } catch (err) {
      setIntegrity('error')
      setSaveError(err instanceof Error ? err.message : 'Could not verify page integrity')
    }
  }

  async function savePage() {
    if (pageId || locked) {
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
    if (locked) {
      return
    }
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
    if (locked) {
      return
    }
    setChunks((current) => current.map((chunk) => (chunk.id === next.id ? next : chunk)))
  }

  function togglePicker(afterId: string) {
    if (locked) {
      return
    }
    setPickerAfterId((current) => (current === afterId ? null : afterId))
  }

  function addChunk(type: ChunkType) {
    if (locked) {
      return
    }
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
    if (locked) {
      return
    }
    setSelectedChunkId(id)
    if (id === null) {
      setCogMenuId(null)
    }
  }

  function deleteChunk(id: string) {
    if (locked) {
      return
    }
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
    <div className={locked ? 'workspace workspace-locked' : 'workspace'}>
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
                disabled={locked || (Boolean(pageId) && !ready)}
                onChange={(event) => setTitle(event.target.value)}
              />
              {locked ? (
                <button
                  type="button"
                  className="page-unlock"
                  onClick={() => void setPageLocked(false)}
                  disabled={lockBusy}
                >
                  {lockBusy ? 'Unlocking…' : 'Unlock'}
                </button>
              ) : (
                <button
                  type="button"
                  className="page-lock"
                  onClick={() => void setPageLocked(true)}
                  disabled={lockBusy || !pageId || !ready}
                  title={pageId ? undefined : 'Save the page before locking'}
                >
                  {lockBusy ? 'Locking…' : 'Lock'}
                </button>
              )}
              <button
                type="button"
                className="page-save"
                onClick={() => void savePage()}
                disabled={locked || !ready || saving || Boolean(pageId)}
              >
                {pageId ? (live ? 'Live' : 'Connecting') : saving ? 'Saving' : 'Save'}
              </button>
            </div>
            {locked ? (
              <div className="page-lock-banner" role="status">
                <p>
                  This page is locked. Anyone can view it, but it can’t be edited until someone unlocks it.
                </p>
                {contentHash ? (
                  <p className="page-lock-hash">
                    <span className="page-lock-hash-label">SHA-256</span>
                    <code>{contentHash}</code>
                  </p>
                ) : null}
                <div className="page-lock-actions">
                  <button
                    type="button"
                    className="page-verify"
                    onClick={() => void checkIntegrity()}
                    disabled={!pageId || integrity === 'checking'}
                  >
                    {integrity === 'checking' ? 'Verifying…' : 'Verify integrity'}
                  </button>
                  {integrity === 'ok' ? (
                    <span className="page-integrity page-integrity-ok">Snapshot matches the stored hash</span>
                  ) : null}
                  {integrity === 'mismatch' ? (
                    <span className="page-integrity page-integrity-bad">
                      Snapshot does not match the stored hash
                    </span>
                  ) : null}
                  {integrity === 'error' ? (
                    <span className="page-integrity page-integrity-bad">Verification failed</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {loadError ? <p className="page-message page-message-error">{loadError}</p> : null}
            {pageId && !ready && !loadError ? <p className="page-message">Connecting…</p> : null}
            {saveError ? <p className="page-message page-message-error">{saveError}</p> : null}
            {!pageId || ready ? (
              <>
            {locked ? null : (
              <p className="workspace-note">Drag a block by its handle, or drag Text field onto a block.</p>
            )}
            <article className="doc-page">
              <SortableContext items={chunks.map((chunk) => chunk.id)} strategy={verticalListSortingStrategy}>
                <ul className="chunk-list">
                  {chunks.map((chunk) => (
                    <ChunkBlock
                      key={chunk.id}
                      chunk={chunk}
                      readOnly={locked}
                      selected={!locked && selectedChunkId === chunk.id}
                      menuOpen={!locked && cogMenuId === chunk.id}
                      addOpen={!locked && pickerAfterId === chunk.id}
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
              {locked ? null : (
                <AddChunkButton
                  open={pickerAfterId === PAGE_END}
                  onToggle={() => togglePicker(PAGE_END)}
                  onAdd={addChunk}
                  onClose={() => setPickerAfterId(null)}
                />
              )}
            </article>
              </>
            ) : null}
          </div>
          {locked ? null : (
            <aside className="field-rail">
              <h2>Add fillable fields</h2>
              <div className="field-list">
                <PaletteChip id={NEW_TEXT_FIELD_ID} label="Text field" icon={Type} />
                <PaletteChip id={NEW_SIGNATURE_ID} label="Signature" icon={PenLine} />
                <PaletteChip id={NEW_DATE_ID} label="Date" icon={Calendar} />
              </div>
            </aside>
          )}
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
  readOnly: boolean
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
  readOnly,
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
    useSortable({ id: chunk.id, disabled: readOnly })

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
      {readOnly ? null : (
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
      )}
      <div className="chunk-body" tabIndex={-1}>
        {chunk.type === 'text' ? <TextBlock chunk={chunk} onChange={onChange} readOnly={readOnly} /> : null}
        {chunk.type === 'image' ? <ImageBlock chunk={chunk} onChange={onChange} readOnly={readOnly} /> : null}
        {chunk.type === 'video' ? <VideoBlock chunk={chunk} onChange={onChange} readOnly={readOnly} /> : null}
        {chunk.type === 'table' ? <TableBlock chunk={chunk} onChange={onChange} readOnly={readOnly} /> : null}
        {chunk.type === 'signature' ? (
          <SignatureBlock
            chunk={chunk}
            onChange={onChange}
            onPress={() => onSelect(chunk.id)}
            readOnly={readOnly}
          />
        ) : null}
        {chunk.type === 'date' ? (
          <DateBlock
            chunk={chunk}
            onChange={onChange}
            onPress={() => onSelect(chunk.id)}
            readOnly={readOnly}
          />
        ) : null}
        {selected ? (
          <button type="button" className="chunk-cog" aria-label="Block settings" aria-expanded={menuOpen} onClick={onToggleMenu}>
            <Settings aria-hidden strokeWidth={1.75} />
          </button>
        ) : null}
        {menuOpen ? <BlockMenu onDelete={onDelete} /> : null}
      </div>
      {readOnly ? null : (
        <AddChunkButton
          open={addOpen}
          onToggle={onToggleAdd}
          onAdd={onAdd}
          onClose={onCloseAdd}
        />
      )}
    </li>
  )
}
