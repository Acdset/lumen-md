import type { Extension } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { rust } from '@codemirror/lang-rust'
import { go } from '@codemirror/lang-go'
import { sass } from '@codemirror/lang-sass'
import { less } from '@codemirror/lang-less'
import { languages } from '@codemirror/language-data'
import { LanguageDescription } from '@codemirror/language'

const MARKDOWN_EXT = /\.(md|markdown|mdown|mkd|mdx)$/i

export function fileBaseName(fileName?: string | null) {
  if (!fileName) return ''
  return fileName.includes('/') ? fileName.split('/').pop() || fileName : fileName
}

export function isMarkdownFile(fileName?: string | null) {
  const name = fileBaseName(fileName)
  if (!name) return true
  return MARKDOWN_EXT.test(name)
}

/** 非 Markdown 的源码/配置文件，使用等宽字体与折叠 gutter */
export function isCodeFile(fileName?: string | null) {
  return !isMarkdownFile(fileName)
}

function extensionOf(fileName?: string | null) {
  const name = fileBaseName(fileName).toLowerCase()
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1) : ''
}

function syncLanguage(ext: string): Extension | null {
  switch (ext) {
    case 'json':
    case 'jsonc':
    case 'json5':
      return json()
    case 'html':
    case 'htm':
      return html()
    case 'css':
      return css()
    case 'scss':
      return sass()
    case 'sass':
      return sass({ indented: true })
    case 'less':
      return less()
    case 'js':
    case 'mjs':
    case 'cjs':
      return javascript()
    case 'jsx':
      return javascript({ jsx: true })
    case 'ts':
    case 'mts':
    case 'cts':
      return javascript({ typescript: true })
    case 'tsx':
      return javascript({ typescript: true, jsx: true })
    case 'xml':
    case 'svg':
    case 'plist':
      return xml()
    case 'yml':
    case 'yaml':
      return yaml()
    case 'py':
      return python()
    case 'sql':
      return sql()
    case 'java':
      return java()
    case 'c':
    case 'h':
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'hpp':
    case 'hxx':
    case 'mm':
      return cpp()
    case 'rs':
      return rust()
    case 'go':
      return go()
    default:
      return null
  }
}

export function languageForFile(fileName?: string | null): Extension {
  if (isMarkdownFile(fileName)) {
    return markdown({ base: markdownLanguage, codeLanguages: languages })
  }
  const ext = extensionOf(fileName)
  const sync = syncLanguage(ext)
  if (sync) return sync
  return []
}

/** 对未同步覆盖的扩展名，通过 language-data 异步补齐 */
export async function loadLanguageForFile(fileName?: string | null): Promise<Extension> {
  if (isMarkdownFile(fileName)) {
    return markdown({ base: markdownLanguage, codeLanguages: languages })
  }
  const name = fileBaseName(fileName)
  const ext = extensionOf(name)
  const sync = syncLanguage(ext)
  if (sync) return sync

  const desc = LanguageDescription.matchFilename(languages, name)
  if (desc) {
    try {
      return await desc.load()
    } catch {
      return []
    }
  }
  return []
}
