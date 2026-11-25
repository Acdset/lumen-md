import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { exportHtmlDocument, renderMarkdown } from '@/lib/markdown'
import type { ThemeId } from '@/store/appStore'
import { loadOfficeFromDocument, htmlToDocxBase64, excelSheetsToBase64 } from '@/lib/office'
import type { OpenedDocument } from '../../electron/preload'
import { detectDocumentKind, isBinaryDocument } from '@/lib/documentKind'

export type FindRequest = {
  query: string
  caseSensitive?: boolean
  /** 跳到下一个匹配；与 backwards 都不传时选中第一个 */
  next?: boolean
  backwards?: boolean
  replace?: string
  replaceAll?: boolean
}

export type FindResult = {
  current: number
  total: number
}

export type EditorBridge = {
  applyFormat: (action: string, payload?: unknown) => void
  focus: () => void
  find?: (request: FindRequest) => FindResult
  clearFind?: () => void
}

let bridge: EditorBridge | null = null

export function registerEditorBridge(next: EditorBridge | null) {
  bridge = next
}

export function getEditorBridge() {
  return bridge
}

function requireLumen() {
  if (!window.lumen) {
    console.error('[Lumen] preload API 不可用：window.lumen 未注入')
    window.alert('原生桥接未就绪，请完全退出后重新运行 npm run dev')
    return null
  }
  return window.lumen
}

async function applyOpenedDocument(doc: OpenedDocument) {
  const api = requireLumen()
  if (!api) return
  const loaded = await loadOfficeFromDocument(doc)
  useAppStore.getState().setFile(doc.path, loaded.content, {
    kind: doc.kind,
    base64: loaded.base64,
    mime: loaded.mime ?? doc.mime,
    html: loaded.html,
    sheets: loaded.sheets,
  })
  await api.setTitle(`${doc.path.split(/[/\\]/).pop()} — Lumen`)
}

async function saveCurrent(saveAs = false) {
  const api = requireLumen()
  if (!api) return
  try {
    const state = useAppStore.getState()
    let path = state.filePath
    if (!path || saveAs) {
      path = await api.saveFileDialog(path ?? state.fileName)
      if (!path) return
    }

    const kind = detectDocumentKind(path)
    if (kind === 'word') {
      const base64 = await htmlToDocxBase64(state.htmlContent || '<p></p>', state.fileName)
      // 旧 .doc 另存时改为 .docx
      if (/\.doc$/i.test(path) && !/\.docx$/i.test(path)) {
        path = path.replace(/\.doc$/i, '.docx')
      }
      await api.writeBuffer(path, base64)
      state.setBinaryBase64(base64)
    } else if (kind === 'excel') {
      const base64 = await excelSheetsToBase64(state.excelSheets)
      if (/\.xls$/i.test(path) && !/\.xlsx$/i.test(path)) {
        path = path.replace(/\.xls$/i, '.xlsx')
      }
      await api.writeBuffer(path, base64)
      state.setBinaryBase64(base64)
    } else if (kind === 'pdf' || kind === 'image') {
      if (!state.binaryBase64) {
        window.alert(kind === 'image' ? '没有可保存的图片数据。' : '没有可保存的 PDF 数据。')
        return
      }
      await api.writeBuffer(path, state.binaryBase64)
    } else {
      await api.writeFile(path, state.content)
    }

    state.markSaved(path)
    await api.setTitle(`${path.split(/[/\\]/).pop()} — Lumen`)
  } catch (err) {
    console.error('[Lumen] save failed', err)
    window.alert(`保存失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

async function openPathContent(filePath: string, content: string) {
  const api = requireLumen()
  if (!api) return
  useAppStore.getState().setFile(filePath, content)
  await api.setTitle(`${filePath.split(/[/\\]/).pop()} — Lumen`)
}

async function openFile() {
  const api = requireLumen()
  if (!api) return
  try {
    const result = await api.openFile()
    if (!result) return
    await applyOpenedDocument(result)
  } catch (err) {
    console.error('[Lumen] openFile failed', err)
    window.alert(`打开文件失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

async function openExternalFile(payload: OpenedDocument) {
  try {
    await applyOpenedDocument(payload)
  } catch (err) {
    console.error('[Lumen] openExternalFile failed', err)
    window.alert(`打开文件失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

async function openDroppedFiles(fileList: FileList | File[]) {
  const api = requireLumen()
  if (!api) return
  const files = Array.from(fileList)
  for (const file of files) {
    const filePath = api.getPathForFile(file)
    if (!filePath) continue
    try {
      const doc = await api.readDocument(filePath)
      await applyOpenedDocument(doc)
      return
    } catch (err) {
      console.error('[Lumen] drop open failed', filePath, err)
      window.alert(`打开文件失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

async function openTreeFile(filePath: string) {
  const api = requireLumen()
  if (!api) return
  try {
    const doc = await api.readDocument(filePath)
    await applyOpenedDocument(doc)
  } catch (err) {
    console.error('[Lumen] openTreeFile failed', err)
    window.alert(`打开文件失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

async function openFolder() {
  const api = requireLumen()
  if (!api) return
  try {
    const folder = await api.openFolder()
    if (!folder) return
    const tree = await api.readDirTree(folder)
    useAppStore.getState().setFolder(tree.root, tree.name, tree.children)
  } catch (err) {
    console.error('[Lumen] openFolder failed', err)
    window.alert(`打开文件夹失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

async function exportHtml() {
  const api = requireLumen()
  if (!api) return
  try {
    const state = useAppStore.getState()
    if (isBinaryDocument(state.documentKind)) {
      window.alert('办公文档请使用「另存为」保存原格式。')
      return
    }
    const path = await api.saveFileDialog(
      (state.filePath ?? state.fileName).replace(/\.md$/i, '.html'),
    )
    if (!path) return
    const css = document.getElementById('export-css')?.textContent ?? ''
    const html = exportHtmlDocument(state.fileName.replace(/\.md$/i, ''), state.content, css)
    await api.writeFile(path, html)
  } catch (err) {
    console.error('[Lumen] exportHtml failed', err)
    window.alert(`导出失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

export function useMenuActions() {
  useEffect(() => {
    if (!window.lumen) {
      console.warn('[Lumen] window.lumen missing on mount')
      return
    }

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      void openDroppedFiles(e.dataTransfer.files)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)

    const unsubs = [
      window.lumen.onMenu('app:open-file', (payload) => {
        const data = payload as OpenedDocument | undefined
        if (data?.path) {
          void openExternalFile({
            path: data.path,
            kind: data.kind ?? detectDocumentKind(data.path),
            content: data.content ?? '',
            base64: data.base64,
            mime: data.mime,
          })
        }
      }),
      window.lumen.onMenu('app:open-folder', (payload) => {
        const tree = payload as { root?: string; name?: string; children?: unknown } | undefined
        if (tree?.root && tree.name && Array.isArray(tree.children)) {
          useAppStore.getState().setFolder(
            tree.root,
            tree.name,
            tree.children as import('@/store/appStore').FileNode[],
          )
        }
      }),
      window.lumen.onMenu('menu:new', () => useAppStore.getState().newDocument()),
      window.lumen.onMenu('menu:open', () => void openFile()),
      window.lumen.onMenu('menu:open-folder', () => void openFolder()),
      window.lumen.onMenu('menu:save', () => void saveCurrent(false)),
      window.lumen.onMenu('menu:save-as', () => void saveCurrent(true)),
      window.lumen.onMenu('menu:export-html', () => void exportHtml()),
      window.lumen.onMenu('menu:preferences', () =>
        useAppStore.getState().setPreferencesOpen(true),
      ),
      window.lumen.onMenu('menu:toggle-sidebar', () => useAppStore.getState().toggleSidebar()),
      window.lumen.onMenu('menu:toggle-outline', () => useAppStore.getState().toggleOutline()),
      window.lumen.onMenu('menu:toggle-source', () => useAppStore.getState().toggleMode()),
      window.lumen.onMenu('menu:mode-wysiwyg', () =>
        useAppStore.getState().setMode('wysiwyg'),
      ),
      window.lumen.onMenu('menu:mode-live', () => useAppStore.getState().setMode('live')),
      window.lumen.onMenu('menu:mode-source', () => useAppStore.getState().setMode('source')),
      window.lumen.onMenu('menu:focus-mode', () => useAppStore.getState().toggleFocusMode()),
      window.lumen.onMenu('menu:typewriter', () => useAppStore.getState().toggleTypewriter()),
      window.lumen.onMenu('menu:find', () => {
        const store = useAppStore.getState()
        if (store.findOpen) {
          store.setFindOpen(false)
          queueMicrotask(() => useAppStore.getState().setFindOpen(true))
        } else {
          store.setFindOpen(true)
        }
      }),
      window.lumen.onMenu('menu:theme', (theme) =>
        useAppStore.getState().setTheme(theme as ThemeId),
      ),
      window.lumen.onMenu('menu:bold', () => bridge?.applyFormat('bold')),
      window.lumen.onMenu('menu:italic', () => bridge?.applyFormat('italic')),
      window.lumen.onMenu('menu:strike', () => bridge?.applyFormat('strike')),
      window.lumen.onMenu('menu:inline-code', () => bridge?.applyFormat('inline-code')),
      window.lumen.onMenu('menu:link', () => bridge?.applyFormat('link')),
      window.lumen.onMenu('menu:heading', (level) => bridge?.applyFormat('heading', level)),
      window.lumen.onMenu('menu:ul', () => bridge?.applyFormat('ul')),
      window.lumen.onMenu('menu:ol', () => bridge?.applyFormat('ol')),
      window.lumen.onMenu('menu:task', () => bridge?.applyFormat('task')),
      window.lumen.onMenu('menu:quote', () => bridge?.applyFormat('quote')),
      window.lumen.onMenu('menu:code-block', () => bridge?.applyFormat('code-block')),
    ]

    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      unsubs.forEach((u) => u())
    }
  }, [])
}

export {
  saveCurrent,
  openFile,
  openFolder,
  exportHtml,
  renderMarkdown,
  openDroppedFiles,
  openTreeFile,
}
