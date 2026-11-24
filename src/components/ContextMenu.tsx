import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ContextMenuItem =
  | {
      id: string
      label: string
      danger?: boolean
      disabled?: boolean
      shortcut?: string
    }
  | { type: 'separator' }

type Props = {
  x: number
  y: number
  items: ContextMenuItem[]
  onSelect: (id: string) => void
  onClose: () => void
}

export function ContextMenu({ x, y, items, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 8
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    setPos({ left, top })
  }, [x, y, items])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onBlur = () => onClose()
    const onScroll = () => onClose()
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer, true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      style={{ left: pos.left, top: pos.top }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => {
        if ('type' in item && item.type === 'separator') {
          return <div key={`sep-${index}`} className="context-menu-sep" />
        }
        const entry = item as Extract<ContextMenuItem, { id: string }>
        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            className={`context-menu-item ${entry.danger ? 'danger' : ''}`}
            disabled={entry.disabled}
            onClick={() => {
              if (entry.disabled) return
              onSelect(entry.id)
              onClose()
            }}
          >
            <span>{entry.label}</span>
            {entry.shortcut ? <span className="context-menu-shortcut">{entry.shortcut}</span> : null}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}
