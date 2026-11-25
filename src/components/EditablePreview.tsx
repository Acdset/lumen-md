import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { htmlToMarkdown } from '@/lib/htmlToMarkdown'
import { registerEditorBridge, type FindRequest, type FindResult } from '@/hooks/useMenuActions'
import {
  findAllInText,
  indexEditableText,
  replaceDomMatch,
  selectDomMatch,
} from '@/lib/domFind'

type Props = {
  content: string
  onChange: (value: string) => void
  focusMode: boolean
  typewriterMode: boolean
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function wrapSelection(tag: string) {
  document.execCommand(tag === 'code' ? 'insertHTML' : tag === 'a' ? 'createLink' : tag, false, tag === 'a' ? 'https://' : undefined)
}

export function EditablePreview({ content, onChange, focusMode, typewriterMode }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const lastMd = useRef(content)
  const suppress = useRef(false)
  const findState = useRef({ query: '', caseSensitive: false, index: -1 })

  const runDomFind = (request: FindRequest): FindResult => {
    const el = ref.current
    if (!el) return { current: 0, total: 0 }

    if (request.replaceAll && request.replace != null) {
      const { text } = indexEditableText(el)
      const matches = findAllInText(text, request.query, !!request.caseSensitive)
      for (let i = matches.length - 1; i >= 0; i -= 1) {
        replaceDomMatch(el, matches[i], request.replace)
      }
      if (matches.length) {
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      findState.current = { query: request.query, caseSensitive: !!request.caseSensitive, index: -1 }
      return { current: 0, total: 0 }
    }

    if (request.replace != null) {
      const { text } = indexEditableText(el)
      const matches = findAllInText(text, request.query, !!request.caseSensitive)
      const idx = findState.current.index
      if (idx < 0 || idx >= matches.length) return { current: 0, total: matches.length }
      replaceDomMatch(el, matches[idx], request.replace)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      const nextText = indexEditableText(el).text
      const nextMatches = findAllInText(nextText, request.query, !!request.caseSensitive)
      const nextIndex = Math.min(idx, Math.max(0, nextMatches.length - 1))
      findState.current = {
        query: request.query,
        caseSensitive: !!request.caseSensitive,
        index: nextMatches.length ? nextIndex : -1,
      }
      if (nextMatches[nextIndex]) selectDomMatch(el, nextMatches[nextIndex])
      return {
        current: nextMatches.length ? nextIndex + 1 : 0,
        total: nextMatches.length,
      }
    }

    const { text } = indexEditableText(el)
    const matches = findAllInText(text, request.query, !!request.caseSensitive)
    if (!matches.length) {
      findState.current = { query: request.query, caseSensitive: !!request.caseSensitive, index: -1 }
      return { current: 0, total: 0 }
    }

    const sameQuery =
      findState.current.query === request.query &&
      findState.current.caseSensitive === !!request.caseSensitive
    let index = sameQuery ? findState.current.index : -1
    if (request.backwards) {
      index = index <= 0 ? matches.length - 1 : index - 1
    } else if (request.next) {
      index = index >= matches.length - 1 ? 0 : index + 1
    } else {
      index = 0
    }
    findState.current = {
      query: request.query,
      caseSensitive: !!request.caseSensitive,
      index,
    }
    selectDomMatch(el, matches[index])
    return { current: index + 1, total: matches.length }
  }

  const paint = (md: string) => {
    const el = ref.current
    if (!el) return
    suppress.current = true
    const html = renderMarkdown(md)
    el.innerHTML = html.trim() ? html : '<p data-placeholder="true"><br></p>'
    lastMd.current = md
    requestAnimationFrame(() => {
      suppress.current = false
    })
  }

  useEffect(() => {
    paint(content)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (content === lastMd.current) return
    if (document.activeElement === ref.current) return
    paint(content)
  }, [content])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    registerEditorBridge({
      focus: () => el.focus(),
      find: (request) => runDomFind(request),
      clearFind: () => {
        findState.current = { query: '', caseSensitive: false, index: -1 }
      },
      applyFormat: (action, payload) => {
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
          case 'inline-code': {
            const sel = window.getSelection()?.toString() || 'code'
            document.execCommand('insertHTML', false, `<code>${sel}</code>`)
            break
          }
          case 'link':
            wrapSelection('a')
            break
          case 'heading': {
            const level = Number(payload) || 1
            document.execCommand('formatBlock', false, `h${level}`)
            break
          }
          case 'ul':
            document.execCommand('insertUnorderedList')
            break
          case 'ol':
            document.execCommand('insertOrderedList')
            break
          case 'quote':
            document.execCommand('formatBlock', false, 'blockquote')
            break
          case 'code-block': {
            const sel = window.getSelection()?.toString() || ''
            document.execCommand(
              'insertHTML',
              false,
              `<pre class="hljs"><code>${sel || 'code'}</code></pre><p><br></p>`,
            )
            break
          }
          case 'task': {
            document.execCommand(
              'insertHTML',
              false,
              `<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox"> 任务</li></ul><p><br></p>`,
            )
            break
          }
          case 'insert-md': {
            document.execCommand(
              'insertHTML',
              false,
              `<table><thead><tr><th>列1</th><th>列2</th><th>列3</th></tr></thead><tbody><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><p><br></p>`,
            )
            break
          }
          default:
            break
        }
        el.dispatchEvent(new Event('input', { bubbles: true }))
      },
    })

    return () => registerEditorBridge(null)
  }, [])

  const syncFromDom = () => {
    const el = ref.current
    if (!el || suppress.current) return
    const md = htmlToMarkdown(el.innerHTML)
    if (md === lastMd.current) return
    lastMd.current = md
    onChange(md)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertText', false, '  ')
    }
  }

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'A') {
      e.preventDefault()
      const href = (target as HTMLAnchorElement).getAttribute('href')
      if (href) window.open(href, '_blank', 'noopener,noreferrer')
    }
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      requestAnimationFrame(syncFromDom)
    }
  }

  return (
    <div
      className={`editable-preview ${focusMode ? 'is-focus' : ''} ${typewriterMode ? 'is-typewriter' : ''}`}
    >
      <article
        ref={ref}
        className="markdown-body is-editable"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={syncFromDom}
        onBlur={syncFromDom}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onFocus={() => {
          const el = ref.current
          if (!el) return
          if (el.querySelector('[data-placeholder]') && !el.textContent?.trim()) {
            placeCaretAtEnd(el)
          }
        }}
        data-placeholder="开始写作…"
      />
    </div>
  )
}
