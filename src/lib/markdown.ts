import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import hljs from 'highlight.js'
import katex from 'katex'
import type { OutlineItem } from '@/store/appStore'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  // Typora 风格：单个换行也渲染为 <br>，避免源码换行在预览里挤成一行
  breaks: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code class="language-${lang}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
      } catch {
        /* fallthrough */
      }
    }
    return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`
  },
}).use(taskLists, { enabled: true, label: true })

const defaultFence = md.renderer.rules.fence
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const info = token.info.trim()
  if (info === 'math' || info === 'katex') {
    const tex = token.content.trim()
    try {
      return `<div class="math-block" data-tex="${escapeHtml(tex)}">${katex.renderToString(tex, {
        displayMode: true,
        throwOnError: false,
      })}</div>`
    } catch {
      return `<pre class="math-error">${escapeHtml(token.content)}</pre>`
    }
  }
  return defaultFence ? defaultFence(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
}

const defaultInline = md.renderer.rules.code_inline
md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
  const content = tokens[idx].content
  if (content.startsWith('$') && content.endsWith('$') && content.length > 2) {
    try {
      return katex.renderToString(content.slice(1, -1), { throwOnError: false })
    } catch {
      /* fallthrough */
    }
  }
  return defaultInline
    ? defaultInline(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}

md.inline.ruler.before('escape', 'math_inline', (state, silent) => {
  if (state.src[state.pos] !== '$') return false
  if (state.src[state.pos + 1] === '$') return false
  const start = state.pos + 1
  let end = start
  while (end < state.posMax) {
    if (state.src[end] === '$' && state.src[end - 1] !== '\\') break
    end++
  }
  if (end >= state.posMax || state.src[end] !== '$') return false
  const content = state.src.slice(start, end)
  if (!content.trim()) return false
  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.content = content
    token.markup = '$'
  }
  state.pos = end + 1
  return true
})

md.renderer.rules.math_inline = (tokens, idx) => {
  try {
    return katex.renderToString(tokens[idx].content, { throwOnError: false })
  } catch {
    return escapeHtml(`$${tokens[idx].content}$`)
  }
}

export function renderMarkdown(source: string): string {
  return md.render(source)
}

/** 去掉标题里的 Markdown 语法，大纲只显示纯文本 */
export function stripMarkdownInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
    .replace(/#+\s*$/g, '')
    .replace(/^\s*#+\s*/, '')
    .trim()
}

export function extractOutline(source: string): OutlineItem[] {
  const lines = source.split('\n')
  const outline: OutlineItem[] = []
  let inFence = false

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence
      return
    }
    if (inFence) return
    const match = /^(#{1,6})\s+(.+)$/.exec(line)
    if (match) {
      const text = stripMarkdownInline(match[2])
      if (!text) return
      outline.push({
        id: `h-${index}-${text.slice(0, 24)}`,
        level: match[1].length,
        text,
        line: index,
      })
    }
  })
  return outline
}

export function exportHtmlDocument(title: string, markdown: string, css: string): string {
  const body = renderMarkdown(markdown)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeAttr(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css" />
<style>
${css}
body { max-width: 720px; margin: 48px auto; padding: 0 24px; }
</style>
</head>
<body class="markdown-body">
${body}
</body>
</html>`
}

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function wrapSelection(
  text: string,
  from: number,
  to: number,
  before: string,
  after: string = before,
): { text: string; selectionStart: number; selectionEnd: number } {
  const selected = text.slice(from, to)
  const next = text.slice(0, from) + before + selected + after + text.slice(to)
  return {
    text: next,
    selectionStart: from + before.length,
    selectionEnd: from + before.length + selected.length,
  }
}

export function prefixLines(
  text: string,
  from: number,
  to: number,
  prefix: string,
): { text: string; selectionStart: number; selectionEnd: number } {
  const start = text.lastIndexOf('\n', from - 1) + 1
  const endIdx = text.indexOf('\n', to)
  const end = endIdx === -1 ? text.length : endIdx
  const block = text.slice(start, end)
  const nextBlock = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line : prefix + line))
    .join('\n')
  const next = text.slice(0, start) + nextBlock + text.slice(end)
  return { text: next, selectionStart: start, selectionEnd: start + nextBlock.length }
}
