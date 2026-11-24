import { useEffect, useMemo } from 'react'
import { TitleBar } from '@/components/TitleBar'
import { Sidebar } from '@/components/Sidebar'
import { Outline } from '@/components/Outline'
import { StatusBar } from '@/components/StatusBar'
import { SourceEditor } from '@/components/SourceEditor'
import { LivePreview } from '@/components/LivePreview'
import { EditablePreview } from '@/components/EditablePreview'
import { Preferences } from '@/components/Preferences'
import { FindBar } from '@/components/FindBar'
import { useAppStore } from '@/store/appStore'
import { extractOutline } from '@/lib/markdown'
import { openFile, openFolder, saveCurrent, useMenuActions } from '@/hooks/useMenuActions'

function resolveTheme(theme: string): 'light' | 'dark' {
  if (theme === 'ink') return 'dark'
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

const themeLabels: Record<string, string> = {
  paper: '纸白',
  ink: '夜墨',
  parchment: '羊皮',
  system: '系统',
}

const modeLabels: Record<string, string> = {
  wysiwyg: '预览编辑',
  live: '分栏预览',
  source: '源码',
}

export default function App() {
  useMenuActions()

  const content = useAppStore((s) => s.content)
  const filePath = useAppStore((s) => s.filePath)
  const fileName = useAppStore((s) => s.fileName)
  const dirty = useAppStore((s) => s.dirty)
  const mode = useAppStore((s) => s.mode)
  const theme = useAppStore((s) => s.theme)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const outlineOpen = useAppStore((s) => s.outlineOpen)
  const focusMode = useAppStore((s) => s.focusMode)
  const typewriterMode = useAppStore((s) => s.typewriterMode)
  const folderPath = useAppStore((s) => s.folderPath)
  const folderName = useAppStore((s) => s.folderName)
  const fileTree = useAppStore((s) => s.fileTree)
  const wordCount = useAppStore((s) => s.wordCount)
  const findOpen = useAppStore((s) => s.findOpen)
  const findQuery = useAppStore((s) => s.findQuery)
  const preferencesOpen = useAppStore((s) => s.preferencesOpen)
  const setContent = useAppStore((s) => s.setContent)
  const setFile = useAppStore((s) => s.setFile)
  const setFolder = useAppStore((s) => s.setFolder)
  const newDocument = useAppStore((s) => s.newDocument)
  const setOutline = useAppStore((s) => s.setOutline)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const toggleOutline = useAppStore((s) => s.toggleOutline)
  const toggleMode = useAppStore((s) => s.toggleMode)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)
  const outline = useAppStore((s) => s.outline)
  const setPreferencesOpen = useAppStore((s) => s.setPreferencesOpen)
  const setFindOpen = useAppStore((s) => s.setFindOpen)
  const setFindQuery = useAppStore((s) => s.setFindQuery)
  const setTheme = useAppStore((s) => s.setTheme)
  const setMode = useAppStore((s) => s.setMode)
  const setFocusMode = useAppStore((s) => s.setFocusMode)
  const setTypewriterMode = useAppStore((s) => s.setTypewriterMode)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const setOutlineOpen = useAppStore((s) => s.setOutlineOpen)

  const resolved = resolveTheme(theme)
  const skin = theme === 'system' ? (resolved === 'dark' ? 'ink' : 'paper') : theme

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = skin
    root.dataset.colorScheme = resolved
    root.style.colorScheme = resolved
    // 同步到 body，避免个别样式只吃 body 继承时仍用浅色文字
    document.body.dataset.theme = skin
    document.body.style.color = ''
    document.body.style.background = ''
  }, [skin, resolved])

  useEffect(() => {
    setOutline(extractOutline(content))
  }, [content, setOutline])

  useEffect(() => {
    const title = `${dirty ? '• ' : ''}${fileName} — Lumen`
    document.title = title
    void window.lumen?.setTitle(title)
  }, [fileName, dirty])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 's') {
        e.preventDefault()
        void saveCurrent(e.shiftKey)
      }
      if (meta && e.key === ',') {
        e.preventDefault()
        setPreferencesOpen(true)
      }
      if (e.key === 'Escape') {
        if (preferencesOpen) setPreferencesOpen(false)
        else if (findOpen) setFindOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preferencesOpen, setPreferencesOpen, findOpen, setFindOpen])

  const modeLabel = useMemo(() => modeLabels[mode] ?? mode, [mode])

  const openTreeFile = async (path: string) => {
    const text = await window.lumen.readFile(path)
    setFile(path, text)
  }

  const refreshTree = async () => {
    if (!folderPath) return
    const tree = await window.lumen.readDirTree(folderPath)
    setFolder(tree.root, tree.name, tree.children)
  }

  const handleFileDeleted = (deletedPath: string) => {
    const current = useAppStore.getState().filePath
    if (!current) return
    if (current === deletedPath || current.startsWith(deletedPath + '/')) {
      newDocument()
    }
  }

  const handleFileRenamed = (fromPath: string, toPath: string) => {
    const current = useAppStore.getState().filePath
    if (!current) return
    let nextPath: string | null = null
    if (current === fromPath) nextPath = toPath
    else if (current.startsWith(fromPath + '/')) nextPath = toPath + current.slice(fromPath.length)
    if (!nextPath) return
    useAppStore.setState({
      filePath: nextPath,
      fileName: nextPath.split('/').pop() || useAppStore.getState().fileName,
    })
  }

  const jumpToLine = (line: number) => {
    if (mode === 'wysiwyg') {
      const headings = document.querySelectorAll('.editable-preview .markdown-body :is(h1,h2,h3,h4,h5,h6)')
      const index = outline.findIndex((item) => item.line === line)
      const target = headings[index] as HTMLElement | undefined
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (mode === 'live') {
      const headings = document.querySelectorAll('.live-preview .markdown-body :is(h1,h2,h3,h4,h5,h6)')
      const index = outline.findIndex((item) => item.line === line)
      const target = headings[index] as HTMLElement | undefined
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    requestAnimationFrame(() => {
      const el = document.querySelector('.source-editor .cm-scroller') as HTMLElement | null
      if (!el) return
      const lineHeight = 28
      el.scrollTo({ top: Math.max(0, line * lineHeight - 80), behavior: 'smooth' })
    })
  }

  return (
    <div className={`app ${focusMode ? 'focus-mode' : ''}`}>
      <TitleBar
        fileName={fileName}
        dirty={dirty}
        mode={mode}
        sidebarOpen={sidebarOpen}
        outlineOpen={outlineOpen}
        focusMode={focusMode}
        onToggleSidebar={toggleSidebar}
        onToggleOutline={toggleOutline}
        onToggleMode={toggleMode}
        onToggleFocus={toggleFocusMode}
        onOpenFile={() => void openFile()}
        onOpenFolder={() => void openFolder()}
        onSave={() => void saveCurrent(false)}
        onFind={() => setFindOpen(true)}
        onPreferences={() => setPreferencesOpen(true)}
      />

      <FindBar
        open={findOpen}
        initialQuery={findQuery}
        onClose={() => setFindOpen(false)}
        onQueryChange={setFindQuery}
      />

      <div
        className={`workspace ${sidebarOpen && !focusMode ? 'has-sidebar' : ''} ${outlineOpen && !focusMode ? 'has-outline' : ''}`}
      >
        {sidebarOpen && !focusMode && (
          <Sidebar
            folderName={folderName}
            folderPath={folderPath}
            tree={fileTree}
            activePath={filePath}
            onOpenFile={(p) => void openTreeFile(p)}
            onOpenFolder={() => void openFolder()}
            onRefreshTree={() => void refreshTree()}
            onFileDeleted={handleFileDeleted}
            onFileRenamed={handleFileRenamed}
            onFileCreated={(p) => void openTreeFile(p)}
          />
        )}

        <main className={`editor-pane mode-${mode}`}>
          {mode === 'wysiwyg' && (
            <section className="pane-wysiwyg">
              <EditablePreview
                content={content}
                onChange={(v) => setContent(v)}
                focusMode={focusMode}
                typewriterMode={typewriterMode}
              />
            </section>
          )}

          {(mode === 'source' || mode === 'live') && (
            <section className={`pane-source ${mode === 'live' ? 'split' : 'full'}`}>
              <SourceEditor
                value={content}
                onChange={(v) => setContent(v)}
                theme={resolved}
                typewriterMode={typewriterMode}
                focusMode={focusMode}
                fileName={fileName}
              />
            </section>
          )}

          {mode === 'live' && (
            <section className="pane-preview">
              <LivePreview
                content={content}
                focusMode={focusMode}
                typewriterMode={typewriterMode}
              />
            </section>
          )}
        </main>

        {outlineOpen && !focusMode && <Outline items={outline} onJump={jumpToLine} />}
      </div>

      {!focusMode && (
        <StatusBar
          words={wordCount.words}
          chars={wordCount.chars}
          lines={wordCount.lines}
          modeLabel={modeLabel}
          themeLabel={themeLabels[theme] ?? theme}
        />
      )}

      <Preferences
        open={preferencesOpen}
        theme={theme}
        mode={mode}
        focusMode={focusMode}
        typewriterMode={typewriterMode}
        sidebarOpen={sidebarOpen}
        outlineOpen={outlineOpen}
        onClose={() => setPreferencesOpen(false)}
        onTheme={setTheme}
        onMode={setMode}
        onFocusMode={setFocusMode}
        onTypewriter={setTypewriterMode}
        onSidebar={setSidebarOpen}
        onOutline={setOutlineOpen}
      />
    </div>
  )
}
