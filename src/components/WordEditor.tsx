import { useEffect, useRef } from 'react'
import { registerEditorBridge } from '@/hooks/useMenuActions'

type Props = {
  html: string
  onChange: (html: string) => void
  readOnly?: boolean
}

export function WordEditor({ html, onChange, readOnly }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef(html)
  const suppress = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (html === last.current && el.innerHTML) return
    if (document.activeElement === el) return
    suppress.current = true
    el.innerHTML = html || '<p><br></p>'
    last.current = html
    requestAnimationFrame(() => {
      suppress.current = false
    })
  }, [html])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    registerEditorBridge({
      focus: () => el.focus(),
      applyFormat: (action) => {
        el.focus()
        switch (action) {
          case 'bold':
            document.execCommand('bold')
            break
          case 'italic':
            document.execCommand('italic')
            break
          case 'strike':
            document.execCommand('strikeThrough')
            break
          case 'link': {
            const url = window.prompt('链接地址', 'https://')
            if (url) document.execCommand('createLink', false, url)
            break
          }
          default:
            break
        }
      },
    })
    return () => registerEditorBridge(null)
  }, [])

  return (
    <div className="office-pane word-pane">
      <div
        ref={ref}
        className="word-editor markdown-body"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        spellCheck
        onInput={() => {
          if (suppress.current || !ref.current) return
          const next = ref.current.innerHTML
          last.current = next
          onChange(next)
        }}
      />
    </div>
  )
}
