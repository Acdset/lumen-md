import { useEffect, useMemo, useRef } from 'react'
import { renderMarkdown } from '@/lib/markdown'

type Props = {
  content: string
  focusMode: boolean
  typewriterMode: boolean
  onScrollLine?: (ratio: number) => void
}

export function LivePreview({ content, focusMode, typewriterMode }: Props) {
  const html = useMemo(() => renderMarkdown(content), [content])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    root.querySelectorAll('a[href]').forEach((anchor) => {
      const a = anchor as HTMLAnchorElement
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noreferrer')
    })
  }, [html])

  return (
    <div
      className={`live-preview ${focusMode ? 'is-focus' : ''} ${typewriterMode ? 'is-typewriter' : ''}`}
      ref={ref}
    >
      <article
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html || '<p class="placeholder">开始写作，预览将实时呈现…</p>' }}
      />
    </div>
  )
}
