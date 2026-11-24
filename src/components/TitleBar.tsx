import {
  Eye,
  FileCode2,
  FolderOpen,
  Focus,
  PanelLeft,
  PanelRight,
  Save,
  Search,
  Settings,
  Columns2,
} from 'lucide-react'
import type { EditorMode } from '@/store/appStore'

type Props = {
  fileName: string
  dirty: boolean
  mode: EditorMode
  sidebarOpen: boolean
  outlineOpen: boolean
  focusMode: boolean
  onToggleSidebar: () => void
  onToggleOutline: () => void
  onToggleMode: () => void
  onToggleFocus: () => void
  onOpenFile: () => void
  onOpenFolder: () => void
  onSave: () => void
  onFind: () => void
  onPreferences: () => void
}

const modeTitle: Record<EditorMode, string> = {
  wysiwyg: '当前：预览编辑 — 点击切换',
  live: '当前：分栏预览 — 点击切换',
  source: '当前：源码模式 — 点击切换',
}

export function TitleBar({
  fileName,
  dirty,
  mode,
  sidebarOpen,
  outlineOpen,
  focusMode,
  onToggleSidebar,
  onToggleOutline,
  onToggleMode,
  onToggleFocus,
  onOpenFile,
  onOpenFolder,
  onSave,
  onFind,
  onPreferences,
}: Props) {
  return (
    <header className="titlebar">
      <div className="titlebar-drag" />
      <div className="titlebar-left">
        <button
          className={`icon-btn ${sidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          title="侧边栏 ⌘\\"
        >
          <PanelLeft size={16} />
        </button>
        <button className="icon-btn" onClick={onOpenFile} title="打开文件 ⌘O">
          <FileCode2 size={16} />
        </button>
        <button className="icon-btn" onClick={onOpenFolder} title="打开文件夹 ⌘⇧O">
          <FolderOpen size={16} />
        </button>
      </div>
      <div className="titlebar-center">
        <span className="doc-title">
          {fileName}
          {dirty ? ' ·' : ''}
        </span>
        <span className="brand">Lumen</span>
      </div>
      <div className="titlebar-right">
        <button className="icon-btn" onClick={onSave} title="保存 ⌘S">
          <Save size={16} />
        </button>
        <button className="icon-btn" onClick={onFind} title="查找 ⌘F">
          <Search size={16} />
        </button>
        <button className="icon-btn" onClick={onToggleMode} title={modeTitle[mode]}>
          {mode === 'wysiwyg' ? (
            <Eye size={16} />
          ) : mode === 'live' ? (
            <Columns2 size={16} />
          ) : (
            <FileCode2 size={16} />
          )}
        </button>
        <button
          className={`icon-btn ${focusMode ? 'active' : ''}`}
          onClick={onToggleFocus}
          title="专注模式 ⌘⇧F"
        >
          <Focus size={16} />
        </button>
        <button
          className={`icon-btn ${outlineOpen ? 'active' : ''}`}
          onClick={onToggleOutline}
          title="大纲 ⌘⇧\\"
        >
          <PanelRight size={16} />
        </button>
        <button className="icon-btn" onClick={onPreferences} title="偏好设置 ⌘,">
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}
