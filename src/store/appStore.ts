import { create } from 'zustand'
import {
  detectDocumentKind,
  defaultModeForKind,
  isMarkdownFile,
  type DocumentKind,
} from '@/lib/documentKind'

export type ThemeId = 'paper' | 'ink' | 'parchment' | 'system'
export type EditorMode = 'wysiwyg' | 'live' | 'source' | 'office'

export type OutlineItem = {
  id: string
  level: number
  text: string
  line: number
}

export type FileNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export type ExcelSheetData = {
  name: string
  rows: string[][]
}

type AppState = {
  content: string
  /** Word 编辑用的 HTML；Excel/PDF 不用此字段存主内容 */
  htmlContent: string
  /** Excel 工作表 */
  excelSheets: ExcelSheetData[]
  excelActiveSheet: number
  /** PDF / 图片 / 二进制原始 base64（保存 Word/Excel 时由组件生成） */
  binaryBase64: string | null
  /** 图片预览 MIME（HEIC 转码后可能与扩展名不同） */
  imageMime: string | null
  documentKind: DocumentKind
  filePath: string | null
  fileName: string
  dirty: boolean
  mode: EditorMode
  theme: ThemeId
  sidebarOpen: boolean
  outlineOpen: boolean
  focusMode: boolean
  typewriterMode: boolean
  folderPath: string | null
  folderName: string | null
  fileTree: FileNode[]
  outline: OutlineItem[]
  wordCount: { words: number; chars: number; lines: number }
  findOpen: boolean
  findQuery: string
  preferencesOpen: boolean
  setContent: (content: string, markDirty?: boolean) => void
  setHtmlContent: (html: string, markDirty?: boolean) => void
  setExcelSheets: (sheets: ExcelSheetData[], active?: number, markDirty?: boolean) => void
  setExcelActiveSheet: (index: number) => void
  setBinaryBase64: (base64: string | null) => void
  setFile: (
    path: string | null,
    content: string,
    options?: {
      kind?: DocumentKind
      base64?: string
      mime?: string
      html?: string
      sheets?: ExcelSheetData[]
    },
  ) => void
  markSaved: (path?: string) => void
  setMode: (mode: EditorMode) => void
  toggleMode: () => void
  setTheme: (theme: ThemeId) => void
  toggleSidebar: () => void
  toggleOutline: () => void
  setSidebarOpen: (open: boolean) => void
  setOutlineOpen: (open: boolean) => void
  toggleFocusMode: () => void
  setFocusMode: (open: boolean) => void
  toggleTypewriter: () => void
  setTypewriterMode: (open: boolean) => void
  setFolder: (path: string, name: string, tree: FileNode[]) => void
  setOutline: (outline: OutlineItem[]) => void
  setWordCount: (count: { words: number; chars: number; lines: number }) => void
  setFindOpen: (open: boolean) => void
  setFindQuery: (query: string) => void
  setPreferencesOpen: (open: boolean) => void
  newDocument: () => void
}

const WELCOME = `# 欢迎使用 Lumen

Lumen 是一款面向 macOS 的现代化 Markdown 编辑器，灵感来自 Typora —— **所见即所得**，专注写作本身。

## 核心体验

- 预览编辑：所见即所得，不显示源码
- 分栏预览：左侧源码，右侧预览
- 源码模式：\`⌘/\` 查看原始 Markdown
- 文件树与大纲、专注 / 打字机模式
- 纸白 / 夜墨 / 羊皮 主题
- 支持 Markdown / Word / Excel / PDF

## 试试看

### 任务列表

- [x] 打开 Lumen
- [ ] 写下第一篇笔记
- [ ] 导出 HTML

### 代码

\`\`\`ts
const greeting = (name: string) => \`Hello, \${name}!\`
console.log(greeting('Lumen'))
\`\`\`

### 公式

行内公式 $E = mc^2$，以及：

\`\`\`math
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
\`\`\`

### 表格

| 功能 | 快捷键 |
| --- | --- |
| 加粗 | ⌘B |
| 斜体 | ⌘I |
| 保存 | ⌘S |
| 打开 | ⌘O |

> 少即是多。把注意力留给文字。

开始写作吧 —— 删除这段文字，从空白页启程。
`

function countContent(content: string) {
  const lines = content.length === 0 ? 0 : content.split('\n').length
  const chars = content.replace(/\s/g, '').length
  const words = content.trim()
    ? content
        .trim()
        .split(/[\s\u3000]+|(?<=[\u4e00-\u9fff])|(?=[\u4e00-\u9fff])/)
        .filter(Boolean).length
    : 0
  return { words, chars, lines }
}

function countHtml(html: string) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return countContent(text)
}

export const useAppStore = create<AppState>((set, get) => ({
  content: WELCOME,
  htmlContent: '',
  excelSheets: [],
  excelActiveSheet: 0,
  binaryBase64: null,
  imageMime: null,
  documentKind: 'markdown',
  filePath: null,
  fileName: '未命名.md',
  dirty: false,
  mode: 'wysiwyg',
  theme: 'paper',
  sidebarOpen: true,
  outlineOpen: true,
  focusMode: false,
  typewriterMode: false,
  folderPath: null,
  folderName: null,
  fileTree: [],
  outline: [],
  wordCount: countContent(WELCOME),
  findOpen: false,
  findQuery: '',
  preferencesOpen: false,

  setContent: (content, markDirty = true) =>
    set({
      content,
      dirty: markDirty ? true : get().dirty,
      wordCount: countContent(content),
    }),

  setHtmlContent: (html, markDirty = true) =>
    set({
      htmlContent: html,
      dirty: markDirty ? true : get().dirty,
      wordCount: countHtml(html),
    }),

  setExcelSheets: (sheets, active, markDirty = true) =>
    set((s) => ({
      excelSheets: sheets,
      excelActiveSheet: active ?? s.excelActiveSheet,
      dirty: markDirty ? true : s.dirty,
      wordCount: {
        words: sheets.reduce((n, sh) => n + sh.rows.length, 0),
        chars: sheets.reduce(
          (n, sh) => n + sh.rows.reduce((m, r) => m + r.join('').length, 0),
          0,
        ),
        lines: sheets.reduce((n, sh) => n + sh.rows.length, 0),
      },
    })),

  setExcelActiveSheet: (index) => set({ excelActiveSheet: index }),

  setBinaryBase64: (base64) => set({ binaryBase64: base64 }),

  setFile: (path, content, options) => {
    const fileName = path ? path.split(/[/\\]/).pop() || '未命名.md' : '未命名.md'
    const kind = options?.kind ?? detectDocumentKind(fileName)
    const mode = defaultModeForKind(kind) as EditorMode
    set({
      filePath: path,
      fileName,
      content,
      htmlContent: options?.html ?? '',
      excelSheets: options?.sheets ?? [],
      excelActiveSheet: 0,
      binaryBase64: options?.base64 ?? null,
      imageMime: options?.mime ?? null,
      documentKind: kind,
      dirty: false,
      wordCount:
        kind === 'word'
          ? countHtml(options?.html ?? '')
          : kind === 'excel'
            ? {
                words: (options?.sheets ?? []).reduce((n, sh) => n + sh.rows.length, 0),
                chars: 0,
                lines: (options?.sheets ?? []).reduce((n, sh) => n + sh.rows.length, 0),
              }
            : kind === 'image' || kind === 'pdf'
              ? { words: 0, chars: 0, lines: 0 }
              : countContent(content),
      mode,
      // 办公/图片时收起大纲更清爽
      outlineOpen: kind === 'markdown' || kind === 'text' ? get().outlineOpen : false,
    })
  },

  markSaved: (path) =>
    set((s) => {
      const filePath = path ?? s.filePath
      const fileName = filePath?.split(/[/\\]/).pop() || s.fileName
      const nextKind = detectDocumentKind(fileName)
      const typeChanged = s.documentKind !== nextKind
      return {
        dirty: false,
        filePath,
        fileName,
        documentKind: nextKind,
        ...(typeChanged ? { mode: defaultModeForKind(nextKind) as EditorMode } : {}),
      }
    }),

  newDocument: () =>
    set({
      content: '',
      htmlContent: '',
      excelSheets: [],
      excelActiveSheet: 0,
      binaryBase64: null,
      imageMime: null,
      documentKind: 'markdown',
      filePath: null,
      fileName: '未命名.md',
      dirty: false,
      wordCount: { words: 0, chars: 0, lines: 0 },
      outline: [],
      mode: 'wysiwyg',
    }),

  setMode: (mode) => {
    const kind = get().documentKind
    if (kind === 'word' || kind === 'excel' || kind === 'pdf' || kind === 'image') {
      set({ mode: 'office' })
      return
    }
    if (mode === 'office') {
      set({ mode: isMarkdownFile(get().fileName) ? 'wysiwyg' : 'source' })
      return
    }
    set({ mode })
  },
  toggleMode: () =>
    set((s) => {
      if (
        s.documentKind === 'word' ||
        s.documentKind === 'excel' ||
        s.documentKind === 'pdf' ||
        s.documentKind === 'image'
      ) {
        return { mode: 'office' }
      }
      const order: EditorMode[] = ['wysiwyg', 'live', 'source']
      const next = order[(order.indexOf(s.mode === 'office' ? 'wysiwyg' : s.mode) + 1) % order.length]
      return { mode: next }
    }),
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleOutline: () => set((s) => ({ outlineOpen: !s.outlineOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setOutlineOpen: (outlineOpen) => set({ outlineOpen }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  setFocusMode: (focusMode) => set({ focusMode }),
  toggleTypewriter: () => set((s) => ({ typewriterMode: !s.typewriterMode })),
  setTypewriterMode: (typewriterMode) => set({ typewriterMode }),

  setFolder: (path, name, tree) =>
    set({ folderPath: path, folderName: name, fileTree: tree, sidebarOpen: true }),

  setOutline: (outline) => set({ outline }),
  setWordCount: (wordCount) => set({ wordCount }),
  setFindOpen: (findOpen) => set({ findOpen }),
  setFindQuery: (findQuery) => set({ findQuery }),
  setPreferencesOpen: (preferencesOpen) => set({ preferencesOpen }),
}))
