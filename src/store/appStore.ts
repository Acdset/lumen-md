import { create } from 'zustand'

export type ThemeId = 'paper' | 'ink' | 'parchment' | 'system'
export type EditorMode = 'wysiwyg' | 'live' | 'source'

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

type AppState = {
  content: string
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
  setFile: (path: string | null, content: string) => void
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

const MARKDOWN_EXT = /\.(md|markdown|mdown|mkd)$/i

function isMarkdownFile(pathOrName: string | null | undefined) {
  if (!pathOrName) return true
  const name = pathOrName.includes('/') ? pathOrName.split('/').pop() || pathOrName : pathOrName
  return MARKDOWN_EXT.test(name)
}

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

export const useAppStore = create<AppState>((set, get) => ({
  content: WELCOME,
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

  setFile: (path, content) => {
    const fileName = path ? path.split('/').pop() || '未命名.md' : '未命名.md'
    // Markdown 默认预览编辑；其他文本默认源码
    set({
      filePath: path,
      fileName,
      content,
      dirty: false,
      wordCount: countContent(content),
      mode: isMarkdownFile(fileName) ? 'wysiwyg' : 'source',
    })
  },

  markSaved: (path) =>
    set((s) => {
      const filePath = path ?? s.filePath
      const fileName = filePath?.split('/').pop() || s.fileName
      const typeChanged = isMarkdownFile(s.fileName) !== isMarkdownFile(fileName)
      return {
        dirty: false,
        filePath,
        fileName,
        // 仅在另存为导致 md ↔ 非 md 切换时调整默认模式
        ...(typeChanged
          ? { mode: isMarkdownFile(fileName) ? ('wysiwyg' as const) : ('source' as const) }
          : {}),
      }
    }),

  newDocument: () =>
    set({
      content: '',
      filePath: null,
      fileName: '未命名.md',
      dirty: false,
      wordCount: { words: 0, chars: 0, lines: 0 },
      outline: [],
      mode: 'wysiwyg',
    }),


  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((s) => {
      const order: EditorMode[] = ['wysiwyg', 'live', 'source']
      const next = order[(order.indexOf(s.mode) + 1) % order.length]
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
