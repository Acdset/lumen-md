import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { OutlineItem } from '@/store/appStore'

type Props = {
  items: OutlineItem[]
  onJump: (line: number) => void
}

export function Outline({ items, onJump }: Props) {
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => item.text.toLowerCase().includes(q))
  }, [items, query])

  return (
    <aside className="outline">
      <div className="outline-head">大纲</div>
      <div className="panel-search">
        <Search size={14} className="panel-search-icon" />
        <input
          className="panel-search-input"
          value={query}
          placeholder="搜索大纲…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.preventDefault()
              setQuery('')
            }
          }}
        />
        {searching && (
          <button
            type="button"
            className="panel-search-clear"
            title="清除"
            onClick={() => setQuery('')}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="outline-body">
        {items.length === 0 && <p className="outline-empty">标题将显示在这里</p>}
        {items.length > 0 && searching && filtered.length === 0 && (
          <p className="panel-search-empty">无匹配标题</p>
        )}
        {filtered.map((item) => (
          <button
            key={item.id}
            className={`outline-item level-${item.level}`}
            onClick={() => onJump(item.line)}
            title={item.text}
          >
            {item.text}
          </button>
        ))}
      </div>
    </aside>
  )
}
