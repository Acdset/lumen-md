import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Replace, X } from 'lucide-react'
import { getEditorBridge, type FindResult } from '@/hooks/useMenuActions'

type Props = {
  open: boolean
  initialQuery?: string
  onClose: () => void
  onQueryChange?: (query: string) => void
}

const emptyResult: FindResult = { current: 0, total: 0 }

export function FindBar({ open, initialQuery = '', onClose, onQueryChange }: Props) {
  const findRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(initialQuery)
  const [replace, setReplace] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [result, setResult] = useState<FindResult>(emptyResult)

  useEffect(() => {
    if (!open) {
      getEditorBridge()?.clearFind?.()
      setResult(emptyResult)
      return
    }
    setQuery(initialQuery)
    requestAnimationFrame(() => {
      findRef.current?.focus()
      findRef.current?.select()
    })
  }, [open, initialQuery])

  useEffect(() => {
    if (!open) return
    onQueryChange?.(query)
    if (!query) {
      getEditorBridge()?.clearFind?.()
      setResult(emptyResult)
      return
    }
    const next = getEditorBridge()?.find?.({ query, caseSensitive }) ?? emptyResult
    setResult(next)
  }, [open, query, caseSensitive, onQueryChange])

  if (!open) return null

  const runFind = (backwards = false) => {
    if (!query) {
      setResult(emptyResult)
      return
    }
    const next =
      getEditorBridge()?.find?.({
        query,
        caseSensitive,
        backwards,
        next: !backwards,
      }) ?? emptyResult
    setResult(next)
  }

  const runReplace = (all = false) => {
    if (!query) return
    const next =
      getEditorBridge()?.find?.({
        query,
        caseSensitive,
        replace,
        replaceAll: all,
      }) ?? emptyResult
    setResult(next)
  }

  return (
    <div className={`find-bar ${showReplace ? 'has-replace' : ''}`} role="search">
      <div className="find-bar-row">
        <input
          ref={findRef}
          className="find-input"
          value={query}
          placeholder="查找"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              runFind(e.shiftKey)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        <span className="find-count">
          {query ? (result.total ? `${result.current}/${result.total}` : '无结果') : ''}
        </span>
        <button
          type="button"
          className="icon-btn"
          title="上一个"
          onClick={() => runFind(true)}
          disabled={!query || result.total === 0}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="下一个"
          onClick={() => runFind(false)}
          disabled={!query || result.total === 0}
        >
          <ChevronDown size={16} />
        </button>
        <button
          type="button"
          className={`icon-btn ${showReplace ? 'active' : ''}`}
          title="替换"
          onClick={() => setShowReplace((v) => !v)}
        >
          <Replace size={16} />
        </button>
        <label className="find-option" title="区分大小写">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          Aa
        </label>
        <button type="button" className="icon-btn" title="关闭" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {showReplace && (
        <div className="find-bar-row">
          <input
            className="find-input"
            value={replace}
            placeholder="替换为"
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                runReplace(false)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              }
            }}
          />
          <button
            type="button"
            className="ghost-btn find-action"
            onClick={() => runReplace(false)}
            disabled={!query || result.total === 0}
          >
            替换
          </button>
          <button
            type="button"
            className="ghost-btn find-action"
            onClick={() => runReplace(true)}
            disabled={!query || result.total === 0}
          >
            全部替换
          </button>
        </div>
      )}
    </div>
  )
}
