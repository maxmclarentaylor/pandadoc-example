import {
  BadgeDollarSign,
  CirclePlay,
  Image as ImageIcon,
  Images,
  List,
  Palette,
  Plus,
  Shapes,
  Table,
  TextCursorInput,
  Type,
  type LucideIcon,
} from 'lucide-react'
import type { ChunkType } from './chunks/types'

const ADD_MENU: { label: string; shortcut?: string; type?: ChunkType }[] = [
  { label: 'Text', shortcut: '1', type: 'text' },
  { label: 'Image', shortcut: '2', type: 'image' },
  { label: 'Video', shortcut: '3', type: 'video' },
  { label: 'Table', shortcut: '4', type: 'table' },
  { label: 'Quote builder', shortcut: '5' },
  { label: 'Table of contents', shortcut: '6' },
  { label: 'Variable or In-text field', shortcut: '7' },
]

const LIBRARY_MENU = ['Content Library', 'Image Library', 'Canva']

const MENU_ICONS: Record<string, LucideIcon> = {
  Text: Type,
  Image: ImageIcon,
  Video: CirclePlay,
  Table,
  'Quote builder': BadgeDollarSign,
  'Table of contents': List,
  'Variable or In-text field': TextCursorInput,
  'Content Library': Shapes,
  'Image Library': Images,
  Canva: Palette,
}

type AddChunkButtonProps = {
  open: boolean
  onToggle: () => void
  onAdd: (type: ChunkType) => void
  onClose: () => void
}

function MenuIcon({ name }: { name: string }) {
  const Icon = MENU_ICONS[name]
  if (!Icon) {
    return null
  }
  return <Icon className="menu-icon" aria-hidden strokeWidth={1.75} />
}

export default function AddChunkButton({ open, onToggle, onAdd, onClose }: AddChunkButtonProps) {
  return (
    <div className={open ? 'add-chunk-wrap open' : 'add-chunk-wrap'}>
      <button type="button" className="add-chunk" aria-label="Add a block" aria-expanded={open} onClick={onToggle}>
        <Plus aria-hidden strokeWidth={1.75} />
      </button>
      {open ? (
        <div className="chunk-picker" role="menu">
          {ADD_MENU.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => (item.type ? onAdd(item.type) : onClose())}
            >
              <MenuIcon name={item.label} />
              <span>{item.label}</span>
              {item.shortcut ? <span className="shortcut">{item.shortcut}</span> : null}
            </button>
          ))}
          <div className="chunk-picker-divider" />
          {LIBRARY_MENU.map((label) => (
            <button key={label} type="button" role="menuitem" onClick={onClose}>
              <MenuIcon name={label} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
