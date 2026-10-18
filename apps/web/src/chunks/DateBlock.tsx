import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { Calendar } from 'lucide-react'
import 'react-day-picker/style.css'
import type { ChunkChange, DateChunk } from './types'

type DateBlockProps = {
  chunk: DateChunk
  onChange: ChunkChange
  onPress: () => void
}

function parseValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return undefined
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined
  }
  return date
}

function formatValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatLabel(value: string) {
  const date = parseValue(value)
  if (!date) {
    return 'Date'
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default function DateBlock({ chunk, onChange, onPress }: DateBlockProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = parseValue(chunk.value)

  useLayoutEffect(() => {
    if (!open) {
      return
    }
    const button = buttonRef.current
    const popover = popoverRef.current
    if (!button || !popover) {
      return
    }
    const rect = button.getBoundingClientRect()
    const margin = 8
    const height = popover.offsetHeight
    const width = popover.offsetWidth
    let top = rect.bottom + margin
    let left = rect.left
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - height - margin)
    }
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - width - margin)
    }
    popover.style.top = `${top}px`
    popover.style.left = `${left}px`
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className="date-block" ref={rootRef} onPointerDown={onPress}>
      <button
        type="button"
        className="date-field"
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <Calendar aria-hidden strokeWidth={1.75} />
        <span>{formatLabel(chunk.value)}</span>
      </button>
      {open ? (
        <div className="date-popover" ref={popoverRef} role="dialog" aria-label="Choose a date">
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => {
              onChange({ ...chunk, value: day ? formatValue(day) : '' })
              setOpen(false)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
