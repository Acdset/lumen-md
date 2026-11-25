import { useEffect, useMemo, useRef, useState } from 'react'
import { TitleBar } from '@/components/TitleBar'
import { Sidebar } from '@/components/Sidebar'
import { Outline } from '@/components/Outline'
import { StatusBar } from '@/components/StatusBar'
import { SourceEditor } from '@/components/SourceEditor'
import { LivePreview } from '@/components/LivePreview'
import { EditablePreview } from '@/components/EditablePreview'
import { Preferences } from '@/components/Preferences'
import { FindBar } from '@/components/FindBar'
import { FormatToolbar } from '@/components/FormatToolbar'
import { WordEditor } from '@/components/WordEditor'
import { ExcelEditor, excelToolbarActions } from '@/components/ExcelEditor'
import { PdfViewer, type PdfViewerHandle } from '@/components/PdfViewer'
import { ImageViewer, type ImageViewerHandle } from '@/components/ImageViewer'
import { useAppStore } from '@/store/appStore'
import { extractOutline } from '@/lib/markdown'
import { openFile, openFolder, openTreeFile, saveCurrent, useMenuActions } from '@/hooks/useMenuActions'
import { isOfficeOrMarkdown } from '@/lib/documentKind'

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
  office: '预览',
}

export default function App() {
  useMenuActions()

  const content = useAppStore((s) => s.content)
  const htmlContent = useAppStore((s) => s.htmlContent)
  const excelSheets = useAppStore((s) => s.excelSheets)
  const excelActiveSheet = useAppStore((s) => s.excelActiveSheet)
  const binaryBase64 = useAppStore((s) => s.binaryBase64)
  const imageMime = useAppStore((s) => s.imageMime)
  const documentKind = useAppStore((s) => s.documentKind)
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
  const setHtmlContent = useAppStore((s) => s.setHtmlContent)
  const setExcelSheets = useAppStore((s) => s.setExcelSheets)
  const setExcelActiveSheet = useAppStore((s) => s.setExcelActiveSheet)
  const setBinaryBase64 = useAppStore((s) => s.setBinaryBase64)
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

  const pdfRef = useRef<PdfViewerHandle>(null)
  const imageRef = useRef<ImageViewerHandle>(null)
  const [pdfMeta, setPdfMeta] = useState({ page: 1, pageCount: 0, scale: 1.2, busy: false })
  const [imageMeta, setImageMeta] = useState({
    scale: 1,
    rotation: 0,
    naturalWidth: 0,
    naturalHeight: 0,
    cropping: false,
  })

  const resolved = resolveTheme(theme)
  const skin = theme === 'system' ? (resolved === 'dark' ? 'ink' : 'paper') : theme
  const showFormatBar = isOfficeOrMarkdown(documentKind) && !focusMode
  const isOffice = mode === 'office'

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = skin
    root.dataset.colorScheme = resolved
    root.style.colorScheme = resolved
    document.body.dataset.theme = skin
    document.body.style.color = ''
    document.body.style.background = ''
  }, [skin, resolved])

  useEffect(() => {
    if (documentKind === 'markdown' || documentKind === 'text') {
      setOutline(extractOutline(content))
    } else {
      setOutline([])
    }
  }, [content, documentKind, setOutline])

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
      documentKind: useAppStore.getState().documentKind,
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

  const excelActions = excelToolbarActions(excelSheets, excelActiveSheet, setExcelSheets)
  const isLegacyDoc = /\.doc$/i.test(fileName) && !/\.docx$/i.test(fileName)

  return (
    <div className={`app ${focusMode ? 'focus-mode' : ''} ${showFormatBar ? 'has-format-bar' : ''}`}>
      <TitleBar
        fileName={fileName}
        dirty={dirty}
        mode={mode === 'office' ? 'wysiwyg' : mode}
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

      {showFormatBar && (
        <FormatToolbar
          kind={documentKind}
          wordLegacy={isLegacyDoc}
          excel={documentKind === 'excel' ? excelActions : undefined}
          pdf={
            documentKind === 'pdf'
              ? {
                  page: pdfMeta.page,
                  pageCount: pdfMeta.pageCount,
                  scale: pdfMeta.scale,
                  busy: pdfMeta.busy,
                  onPrev: () => pdfRef.current?.prev(),
                  onNext: () => pdfRef.current?.next(),
                  onZoomIn: () => pdfRef.current?.zoomIn(),
                  onZoomOut: () => pdfRef.current?.zoomOut(),
                  onPrint: () => pdfRef.current?.print(),
                  onRotate: () => pdfRef.current?.rotatePage(),
                  onDeletePage: () => pdfRef.current?.deletePage(),
                  onInsertPage: () => pdfRef.current?.insertPage(),
                  onMoveUp: () => pdfRef.current?.movePageUp(),
                  onMoveDown: () => pdfRef.current?.movePageDown(),
                  onAddText: () => pdfRef.current?.addText(),
                }
              : undefined
          }
          image={
            documentKind === 'image'
              ? {
                  scale: imageMeta.scale,
                  naturalWidth: imageMeta.naturalWidth,
                  naturalHeight: imageMeta.naturalHeight,
                  cropping: imageMeta.cropping,
                  onZoomIn: () => imageRef.current?.zoomIn(),
                  onZoomOut: () => imageRef.current?.zoomOut(),
                  onFit: () => imageRef.current?.fit(),
                  onActual: () => imageRef.current?.resetView(),
                  onRotate: () => imageRef.current?.rotate(),
                  onCrop: () => imageRef.current?.startCrop(),
                  onApplyCrop: () => imageRef.current?.applyCrop(),
                  onCancelCrop: () => imageRef.current?.cancelCrop(),
                  onResize: () => imageRef.current?.openResize(),
                }
              : undefined
          }
        />
      )}

      <FindBar
        open={findOpen}
        initialQuery={findQuery}
        onClose={() => setFindOpen(false)}
        onQueryChange={setFindQuery}
      />

      <div
        className={`workspace ${sidebarOpen && !focusMode ? 'has-sidebar' : ''} ${outlineOpen && !focusMode && !isOffice ? 'has-outline' : ''}`}
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

        <main className={`editor-pane mode-${isOffice ? 'office' : mode}`}>
          {isOffice && documentKind === 'word' && (
            <WordEditor
              html={htmlContent}
              onChange={(html) => setHtmlContent(html)}
              readOnly={isLegacyDoc}
            />
          )}

          {isOffice && documentKind === 'excel' && (
            <ExcelEditor
              sheets={excelSheets}
              activeSheet={excelActiveSheet}
              onSheetsChange={setExcelSheets}
              onActiveSheet={setExcelActiveSheet}
            />
          )}

          {isOffice && documentKind === 'pdf' && binaryBase64 && (
            <PdfViewer
              ref={pdfRef}
              base64={binaryBase64}
              onMeta={setPdfMeta}
              onChange={(next) => {
                setBinaryBase64(next)
                useAppStore.setState({ dirty: true })
              }}
            />
          )}

          {isOffice && documentKind === 'image' && binaryBase64 && (
            <ImageViewer
              ref={imageRef}
              base64={binaryBase64}
              fileName={fileName}
              mime={imageMime}
              onMeta={setImageMeta}
              onChange={({ base64: next, mime: nextMime }) => {
                setBinaryBase64(next)
                useAppStore.setState({ imageMime: nextMime, dirty: true })
              }}
            />
          )}

          {!isOffice && mode === 'wysiwyg' && (
            <section className="pane-wysiwyg">
              <EditablePreview
                content={content}
                onChange={(v) => setContent(v)}
                focusMode={focusMode}
                typewriterMode={typewriterMode}
              />
            </section>
          )}

          {!isOffice && (mode === 'source' || mode === 'live') && (
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

          {!isOffice && mode === 'live' && (
            <section className="pane-preview">
              <LivePreview
                content={content}
                focusMode={focusMode}
                typewriterMode={typewriterMode}
              />
            </section>
          )}
        </main>

        {outlineOpen && !focusMode && !isOffice && (
          <Outline items={outline} onJump={jumpToLine} />
        )}
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
        mode={mode === 'office' ? 'wysiwyg' : mode}
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
