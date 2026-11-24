import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { exportHtmlDocument, renderMarkdown } from '@/lib/markdown'
import type { ThemeId } from '@/store/appStore'

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
    await api.writeFile(path, state.content)
    state.markSaved(path)
    await api.setTitle(`${path.split('/').pop()} — Lumen`)
  } catch (err) {
    console.error('[Lumen] save failed', err)
    window.alert(`保存失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

async function openPathContent(filePath: string, content: string) {
  const api = requireLumen()
  if (!api) return
  useAppStore.getState().setFile(filePath, content)
  await api.setTitle(`${filePath.split('/').pop()} — Lumen`)
}

async function openFile() {
  const api = requireLumen()
  if (!api) return
  try {
    const result = await api.openFile()
    if (!result) return
    await openPathContent(result.path, result.content)
  } catch (err) {
    console.error('[Lumen] openFile failed', err)
    window.alert(`打开文件失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

async function openExternalFile(payload: { path: string; content: string }) {
  try {
    await openPathContent(payload.path, payload.content)
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
      // 任意文本：由主进程读入时做二进制启发式校验
      const content = await api.readFile(filePath)
      await openPathContent(filePath, content)
      return
    } catch (err) {
      console.error('[Lumen] drop open failed', filePath, err)
      window.alert(`打开文件失败：${err instanceof Error ? err.message : String(err)}`)
    }
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
        const data = payload as { path?: string; content?: string } | undefined
        if (data?.path != null && data.content != null) {
          void openExternalFile({ path: data.path, content: data.content })
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
          // 已打开时再次触发，让输入框重新聚焦
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

export { saveCurrent, openFile, openFolder, exportHtml, renderMarkdown, openDroppedFiles }
