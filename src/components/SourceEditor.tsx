import { useEffect, useRef } from 'react'
import { EditorState, Compartment, Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  placeholder,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'
import {
  search,
  searchKeymap,
  highlightSelectionMatches,
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
} from '@codemirror/search'
import { prefixLines, wrapSelection } from '@/lib/markdown'
import {
  isCodeFile,
  languageForFile,
  loadLanguageForFile,
} from '@/lib/editorLanguage'
import { registerEditorBridge, type FindRequest, type FindResult } from '@/hooks/useMenuActions'

type Props = {
  value: string
  onChange: (value: string) => void
  theme: 'light' | 'dark'
  typewriterMode: boolean
  focusMode: boolean
  fileName?: string
}

function collectMatches(view: EditorView, query: SearchQuery) {
  const matches: { from: number; to: number }[] = []
  if (!query.valid || !query.search) return matches
  const cursor = query.getCursor(view.state)
  for (let item = cursor.next(); !item.done; item = cursor.next()) {
    matches.push(item.value)
  }
  return matches
}

function matchStats(view: EditorView, query: SearchQuery): FindResult {
  const matches = collectMatches(view, query)
  if (!matches.length) return { current: 0, total: 0 }
  const head = view.state.selection.main.from
  let current = matches.findIndex((m) => m.from >= head)
  if (current < 0) current = 0
  const exact = matches.findIndex(
    (m) => m.from === view.state.selection.main.from && m.to === view.state.selection.main.to,
  )
  return {
    current: (exact >= 0 ? exact : current) + 1,
    total: matches.length,
  }
}

function runSourceFind(view: EditorView, request: FindRequest): FindResult {
  const query = new SearchQuery({
    search: request.query,
    caseSensitive: !!request.caseSensitive,
    literal: true,
    replace: request.replace ?? '',
  })
  view.dispatch({ effects: setSearchQuery.of(query) })

  if (!request.query) return { current: 0, total: 0 }

  if (request.replaceAll && request.replace != null) {
    replaceAll(view)
    return matchStats(view, query)
  }

  if (request.replace != null) {
    replaceNext(view)
    return matchStats(view, query)
  }

  if (request.backwards) {
    findPrevious(view)
  } else if (request.next) {
    findNext(view)
  } else {
    const matches = collectMatches(view, query)
    if (matches[0]) {
      view.dispatch({
        selection: { anchor: matches[0].from, head: matches[0].to },
        scrollIntoView: true,
      })
    }
  }
  return matchStats(view, query)
}

function createFoldMarker(open: boolean) {
  const marker = document.createElement('span')
  marker.className = `cm-fold-marker ${open ? 'is-open' : 'is-closed'}`
  marker.title = open ? '收起' : '展开'
  marker.setAttribute('aria-label', open ? '收起' : '展开')
  marker.innerHTML = open
    ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  return marker
}

function gutterExtensions(focus: boolean): Extension[] {
  if (focus) return []
  return [
    lineNumbers(),
    foldGutter({
      markerDOM: createFoldMarker,
    }),
  ]
}

const lightHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '600', color: '#24292f' },
  { tag: tags.heading1, fontSize: '1.85em' },
  { tag: tags.heading2, fontSize: '1.45em' },
  { tag: tags.heading3, fontSize: '1.2em' },
  { tag: tags.strong, fontWeight: '700', color: '#24292f' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#424242' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#6a6a6a' },
  { tag: tags.link, color: '#4183c4' },
  { tag: tags.url, color: '#4183c4' },
  { tag: tags.monospace, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#c7254e' },
  { tag: tags.quote, color: '#57606a', fontStyle: 'italic' },
  { tag: tags.meta, color: '#9b9b9b' },
  { tag: tags.comment, color: '#6e7781', fontStyle: 'italic' },
  { tag: tags.processingInstruction, color: '#9b9b9b' },
  { tag: tags.punctuation, color: '#9b9b9b' },
  { tag: tags.propertyName, color: '#0550ae' },
  { tag: tags.attributeName, color: '#0550ae' },
  { tag: tags.attributeValue, color: '#0a3069' },
  { tag: tags.tagName, color: '#116329' },
  { tag: tags.className, color: '#953800' },
  { tag: tags.typeName, color: '#953800' },
  { tag: tags.variableName, color: '#24292f' },
  { tag: tags.function(tags.variableName), color: '#8250df' },
  { tag: tags.definition(tags.variableName), color: '#953800' },
  { tag: tags.string, color: '#0a3069' },
  { tag: tags.number, color: '#0550ae' },
  { tag: tags.bool, color: '#cf222e' },
  { tag: tags.null, color: '#cf222e' },
  { tag: tags.keyword, color: '#cf222e' },
  { tag: tags.operator, color: '#cf222e' },
  { tag: tags.atom, color: '#0550ae' },
  { tag: tags.unit, color: '#0550ae' },
  { tag: tags.color, color: '#0550ae' },
  { tag: tags.brace, color: '#57606a' },
  { tag: tags.squareBracket, color: '#57606a' },
  { tag: tags.angleBracket, color: '#57606a' },
])

const darkHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700', color: '#ffffff' },
  { tag: tags.heading1, fontSize: '1.85em' },
  { tag: tags.heading2, fontSize: '1.45em' },
  { tag: tags.heading3, fontSize: '1.2em' },
  { tag: tags.strong, fontWeight: '700', color: '#ffffff' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'rgba(235, 235, 245, 0.85)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'rgba(235, 235, 245, 0.55)' },
  { tag: tags.link, color: '#64d2ff' },
  { tag: tags.url, color: '#64d2ff' },
  { tag: tags.monospace, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#ffa657' },
  { tag: tags.quote, color: 'rgba(235, 235, 245, 0.6)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'rgba(235, 235, 245, 0.4)' },
  { tag: tags.comment, color: 'rgba(235, 235, 245, 0.4)', fontStyle: 'italic' },
  { tag: tags.processingInstruction, color: 'rgba(235, 235, 245, 0.4)' },
  { tag: tags.punctuation, color: 'rgba(235, 235, 245, 0.45)' },
  { tag: tags.propertyName, color: '#79c0ff' },
  { tag: tags.attributeName, color: '#79c0ff' },
  { tag: tags.attributeValue, color: '#a5d6ff' },
  { tag: tags.tagName, color: '#7ee787' },
  { tag: tags.className, color: '#ffa657' },
  { tag: tags.typeName, color: '#ffa657' },
  { tag: tags.variableName, color: '#e6edf3' },
  { tag: tags.function(tags.variableName), color: '#d2a8ff' },
  { tag: tags.definition(tags.variableName), color: '#ffa657' },
  { tag: tags.string, color: '#a5d6ff' },
  { tag: tags.number, color: '#79c0ff' },
  { tag: tags.bool, color: '#ff7b72' },
  { tag: tags.null, color: '#ff7b72' },
  { tag: tags.keyword, color: '#ff7b72' },
  { tag: tags.operator, color: '#ff7b72' },
  { tag: tags.atom, color: '#79c0ff' },
  { tag: tags.unit, color: '#79c0ff' },
  { tag: tags.color, color: '#79c0ff' },
  { tag: tags.brace, color: 'rgba(235, 235, 245, 0.55)' },
  { tag: tags.squareBracket, color: 'rgba(235, 235, 245, 0.55)' },
  { tag: tags.angleBracket, color: 'rgba(235, 235, 245, 0.55)' },
])

function editorTheme(isDark: boolean, typewriter: boolean, focus: boolean, codeLike: boolean) {
  const proseFont =
    '"Avenir Next", "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif'
  const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

  return EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: codeLike ? '14px' : '17px',
        backgroundColor: 'transparent',
      },
      '.cm-content': {
        fontFamily: codeLike ? monoFont : proseFont,
        lineHeight: codeLike ? '1.6' : '1.75',
        maxWidth: codeLike ? '1100px' : '860px',
        margin: '0 auto',
        padding: typewriter ? '40vh 48px' : '48px 48px 30vh',
        caretColor: isDark ? '#ffffff' : '#333333',
        color: isDark ? '#ffffff' : '#333333',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'inherit',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: isDark ? '#ffffff' : '#333333',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: isDark ? 'rgba(100, 210, 255, 0.28)' : 'rgba(65, 131, 196, 0.2)',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        border: 'none',
        color: isDark ? 'rgba(235, 235, 245, 0.35)' : '#9b9b9b',
      },
      '.cm-foldGutter': {
        width: '16px',
      },
      '.cm-foldGutter .cm-gutterElement': {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        cursor: 'pointer',
      },
      '.cm-fold-marker': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '14px',
        height: '14px',
        borderRadius: '3px',
        color: isDark ? 'rgba(235, 235, 245, 0.55)' : '#8a8a8a',
        transition: 'color 0.15s ease, background-color 0.15s ease',
      },
      '.cm-fold-marker:hover': {
        color: isDark ? '#ffffff' : '#333333',
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      },
      '.cm-activeLine': {
        backgroundColor: focus
          ? isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)'
          : 'transparent',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
      },
      '.cm-line': {
        padding: '0 2px',
      },
      '.cm-foldPlaceholder': {
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
        color: isDark ? 'rgba(235, 235, 245, 0.65)' : '#6a6a6a',
        borderRadius: '4px',
        margin: '0 2px',
        padding: '0 6px',
        cursor: 'pointer',
      },
    },
    { dark: isDark },
  )
}

export function SourceEditor({
  value,
  onChange,
  theme,
  typewriterMode,
  focusMode,
  fileName,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const themeComp = useRef(new Compartment())
  const highlightComp = useRef(new Compartment())
  const gutterComp = useRef(new Compartment())
  const languageComp = useRef(new Compartment())
  const updating = useRef(false)
  const fileNameRef = useRef(fileName)
  const langRequest = useRef(0)
  fileNameRef.current = fileName

  useEffect(() => {
    if (!hostRef.current) return

    const isDark = theme === 'dark'
    const codeLike = isCodeFile(fileName)
    const startState = EditorState.create({
      doc: value,
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        placeholder(codeLike ? '' : '开始写作…'),
        languageComp.current.of(languageForFile(fileName)),
        search({ top: true }),
        highlightSelectionMatches(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        gutterComp.current.of(gutterExtensions(focusMode)),
        themeComp.current.of(editorTheme(isDark, typewriterMode, focusMode, codeLike)),
        highlightComp.current.of(syntaxHighlighting(isDark ? darkHighlight : lightHighlight)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !updating.current) {
            onChange(update.state.doc.toString())
          }
          if (typewriterMode && update.selectionSet) {
            const view = update.view
            const head = view.state.selection.main.head
            const coords = view.coordsAtPos(head)
            if (coords) {
              const scroller = view.scrollDOM
              const target =
                coords.top -
                scroller.getBoundingClientRect().top -
                scroller.clientHeight / 2 +
                scroller.scrollTop
              scroller.scrollTo({ top: target, behavior: 'smooth' })
            }
          }
        }),
      ],
    })

    const view = new EditorView({
      state: startState,
      parent: hostRef.current,
    })
    viewRef.current = view

    registerEditorBridge({
      focus: () => view.focus(),
      find: (request) => runSourceFind(view, request),
      clearFind: () => {
        view.dispatch({
          effects: setSearchQuery.of(new SearchQuery({ search: '' })),
        })
      },
      applyFormat: (action, payload) => {
        if (isCodeFile(fileNameRef.current)) return

        const state = view.state
        const sel = state.selection.main
        const text = state.doc.toString()
        let result: { text: string; selectionStart: number; selectionEnd: number } | null = null

        switch (action) {
          case 'bold':
            result = wrapSelection(text, sel.from, sel.to, '**')
            break
          case 'italic':
            result = wrapSelection(text, sel.from, sel.to, '*')
            break
          case 'strike':
            result = wrapSelection(text, sel.from, sel.to, '~~')
            break
          case 'inline-code':
            result = wrapSelection(text, sel.from, sel.to, '`')
            break
          case 'link':
            result = wrapSelection(text, sel.from, sel.to, '[', '](url)')
            break
          case 'heading': {
            const level = Number(payload) || 1
            result = prefixLines(text, sel.from, sel.to, `${'#'.repeat(level)} `)
            break
          }
          case 'ul':
            result = prefixLines(text, sel.from, sel.to, '- ')
            break
          case 'ol':
            result = prefixLines(text, sel.from, sel.to, '1. ')
            break
          case 'task':
            result = prefixLines(text, sel.from, sel.to, '- [ ] ')
            break
          case 'quote':
            result = prefixLines(text, sel.from, sel.to, '> ')
            break
          case 'code-block':
            result = wrapSelection(text, sel.from, sel.to, '```\n', '\n```')
            break
        }

        if (!result) return
        view.dispatch({
          changes: { from: 0, to: state.doc.length, insert: result.text },
          selection: { anchor: result.selectionStart, head: result.selectionEnd },
        })
        view.focus()
      },
    })

    return () => {
      registerEditorBridge(null)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      updating.current = true
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
      updating.current = false
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const isDark = theme === 'dark'
    const codeLike = isCodeFile(fileName)
    const requestId = ++langRequest.current

    view.dispatch({
      effects: [
        languageComp.current.reconfigure(languageForFile(fileName)),
        themeComp.current.reconfigure(editorTheme(isDark, typewriterMode, focusMode, codeLike)),
        highlightComp.current.reconfigure(
          syntaxHighlighting(isDark ? darkHighlight : lightHighlight),
        ),
        gutterComp.current.reconfigure(gutterExtensions(focusMode)),
      ],
    })

    void loadLanguageForFile(fileName).then((lang) => {
      if (langRequest.current !== requestId || !viewRef.current) return
      viewRef.current.dispatch({
        effects: languageComp.current.reconfigure(lang),
      })
    })
  }, [theme, typewriterMode, focusMode, fileName])

  return (
    <div
      className={`source-editor ${focusMode ? 'is-focus' : ''} ${isCodeFile(fileName) ? 'is-code' : ''}`}
      ref={hostRef}
    />
  )
}
