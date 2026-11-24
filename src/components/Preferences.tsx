import { X } from 'lucide-react'
import type { EditorMode, ThemeId } from '@/store/appStore'

type Props = {
  open: boolean
  theme: ThemeId
  mode: EditorMode
  focusMode: boolean
  typewriterMode: boolean
  sidebarOpen: boolean
  outlineOpen: boolean
  onClose: () => void
  onTheme: (theme: ThemeId) => void
  onMode: (mode: EditorMode) => void
  onFocusMode: (v: boolean) => void
  onTypewriter: (v: boolean) => void
  onSidebar: (v: boolean) => void
  onOutline: (v: boolean) => void
}

const themes: { id: ThemeId; label: string; desc: string }[] = [
  { id: 'paper', label: '纸白', desc: '明亮写作纸' },
  { id: 'ink', label: '夜墨', desc: '深色护眼' },
  { id: 'parchment', label: '羊皮', desc: '暖色纸感' },
  { id: 'system', label: '跟随系统', desc: '自动明暗' },
]

const modes: { id: EditorMode; label: string; desc: string }[] = [
  { id: 'wysiwyg', label: '预览编辑', desc: '所见即所得，不显示源码' },
  { id: 'live', label: '分栏预览', desc: '左侧源码，右侧预览' },
  { id: 'source', label: '源码模式', desc: '仅显示 Markdown 源码' },
]

export function Preferences({
  open,
  theme,
  mode,
  focusMode,
  typewriterMode,
  sidebarOpen,
  outlineOpen,
  onClose,
  onTheme,
  onMode,
  onFocusMode,
  onTypewriter,
  onSidebar,
  onOutline,
}: Props) {
  if (!open) return null

  return (
    <div className="pref-overlay" onClick={onClose} role="presentation">
      <div
        className="pref-panel"
        role="dialog"
        aria-modal="true"
        aria-label="偏好设置"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pref-head">
          <div>
            <h2>偏好设置</h2>
            <p>调整编辑体验与外观</p>
          </div>
          <button className="icon-btn" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </header>

        <section className="pref-section">
          <h3>编辑模式</h3>
          <div className="pref-cards">
            {modes.map((item) => (
              <button
                key={item.id}
                className={`pref-card ${mode === item.id ? 'active' : ''}`}
                onClick={() => onMode(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="pref-section">
          <h3>主题</h3>
          <div className="pref-cards theme-cards">
            {themes.map((item) => (
              <button
                key={item.id}
                className={`pref-card ${theme === item.id ? 'active' : ''}`}
                onClick={() => onTheme(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="pref-section">
          <h3>写作辅助</h3>
          <label className="pref-switch">
            <span>专注模式</span>
            <input type="checkbox" checked={focusMode} onChange={(e) => onFocusMode(e.target.checked)} />
          </label>
          <label className="pref-switch">
            <span>打字机模式</span>
            <input
              type="checkbox"
              checked={typewriterMode}
              onChange={(e) => onTypewriter(e.target.checked)}
            />
          </label>
          <label className="pref-switch">
            <span>显示文件树</span>
            <input type="checkbox" checked={sidebarOpen} onChange={(e) => onSidebar(e.target.checked)} />
          </label>
          <label className="pref-switch">
            <span>显示大纲</span>
            <input type="checkbox" checked={outlineOpen} onChange={(e) => onOutline(e.target.checked)} />
          </label>
        </section>

        <footer className="pref-foot">
          <kbd>⌘</kbd>
          <span>+</span>
          <kbd>,</kbd>
          <span>打开此面板</span>
        </footer>
      </div>
    </div>
  )
}
