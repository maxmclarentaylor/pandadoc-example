import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { LucideIcon } from 'lucide-react'

type PaletteChipProps = {
  id: string
  label: string
  icon: LucideIcon
}

export default function PaletteChip({ id, label, icon: Icon }: PaletteChipProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id })
  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <button
      type="button"
      className="field-chip"
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <Icon aria-hidden strokeWidth={1.75} />
      {label}
    </button>
  )
}
