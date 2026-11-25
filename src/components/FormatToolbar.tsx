import type { ReactNode } from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  CheckSquare,
  Table,
  Plus,
  Minus,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Printer,
  Underline,
  RotateCw,
  Maximize2,
  Scan,
  Crop,
  Scaling,
  Check,
  X,
  Trash2,
  FilePlus2,
  ArrowUp,
  ArrowDown,
  Type,
} from 'lucide-react'
import type { DocumentKind } from '@/lib/documentKind'
import { getEditorBridge } from '@/hooks/useMenuActions'

type ExcelActions = {
  addRow: () => void
  addCol: () => void
  removeRow: () => void
  removeCol: () => void
}

type PdfActions = {
  page: number
  pageCount: number
  scale: number
  busy?: boolean
  onPrev: () => void
  onNext: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onPrint: () => void
  onRotate: () => void
  onDeletePage: () => void
  onInsertPage: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onAddText: () => void
}

type ImageActions = {
  scale: number
  naturalWidth: number
  naturalHeight: number
  cropping: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onActual: () => void
  onRotate: () => void
  onCrop: () => void
  onApplyCrop: () => void
  onCancelCrop: () => void
  onResize: () => void
}

type Props = {
  kind: DocumentKind
  excel?: ExcelActions
  pdf?: PdfActions
  image?: ImageActions
  wordLegacy?: boolean
}

function ToolBtn({
  title,
  onClick,
  children,
  disabled,
}: {
  title: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button type="button" className="format-btn" title={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function Sep() {
  return <span className="format-sep" />
}

export function FormatToolbar({ kind, excel, pdf, image, wordLegacy }: Props) {
  if (kind === 'text' || kind === 'unknown') return null

  if (kind === 'image' && image) {
    const size =
      image.naturalWidth && image.naturalHeight
        ? `${image.naturalWidth}×${image.naturalHeight}`
        : '—'
    if (image.cropping) {
      return (
        <div className="format-toolbar">
          <span className="format-hint" style={{ marginLeft: 0 }}>
            裁剪中
          </span>
          <Sep />
          <ToolBtn title="应用裁剪" onClick={image.onApplyCrop}>
            <Check size={15} />
            <span>应用</span>
          </ToolBtn>
          <ToolBtn title="取消裁剪" onClick={image.onCancelCrop}>
            <X size={15} />
            <span>取消</span>
          </ToolBtn>
          <span className="format-label">{size}</span>
        </div>
      )
    }
    return (
      <div className="format-toolbar">
        <ToolBtn title="缩小" onClick={image.onZoomOut}>
          <ZoomOut size={15} />
        </ToolBtn>
        <span className="format-label">{Math.round(image.scale * 100)}%</span>
        <ToolBtn title="放大" onClick={image.onZoomIn}>
          <ZoomIn size={15} />
        </ToolBtn>
        <Sep />
        <ToolBtn title="适应窗口" onClick={image.onFit}>
          <Maximize2 size={15} />
        </ToolBtn>
        <ToolBtn title="实际大小" onClick={image.onActual}>
          <Scan size={15} />
        </ToolBtn>
        <Sep />
        <ToolBtn title="旋转 90°（写入文件）" onClick={image.onRotate}>
          <RotateCw size={15} />
          <span>旋转</span>
        </ToolBtn>
        <ToolBtn title="裁剪" onClick={image.onCrop}>
          <Crop size={15} />
          <span>裁剪</span>
        </ToolBtn>
        <ToolBtn title="调整大小" onClick={image.onResize}>
          <Scaling size={15} />
          <span>大小</span>
        </ToolBtn>
        <span className="format-label">{size}</span>
        <span className="format-hint">图片编辑</span>
      </div>
    )
  }

  if (kind === 'pdf' && pdf) {
    const disabled = !!pdf.busy
    return (
      <div className="format-toolbar">
        <ToolBtn title="上一页" onClick={pdf.onPrev} disabled={disabled || pdf.page <= 1}>
          <ChevronLeft size={15} />
        </ToolBtn>
        <span className="format-label">
          {pdf.page} / {pdf.pageCount || '—'}
        </span>
        <ToolBtn
          title="下一页"
          onClick={pdf.onNext}
          disabled={disabled || pdf.page >= pdf.pageCount}
        >
          <ChevronRight size={15} />
        </ToolBtn>
        <Sep />
        <ToolBtn title="缩小" onClick={pdf.onZoomOut} disabled={disabled}>
          <ZoomOut size={15} />
        </ToolBtn>
        <span className="format-label">{Math.round(pdf.scale * 100)}%</span>
        <ToolBtn title="放大" onClick={pdf.onZoomIn} disabled={disabled}>
          <ZoomIn size={15} />
        </ToolBtn>
        <Sep />
        <ToolBtn title="旋转当前页 90°" onClick={pdf.onRotate} disabled={disabled}>
          <RotateCw size={15} />
          <span>旋转</span>
        </ToolBtn>
        <ToolBtn title="添加文字" onClick={pdf.onAddText} disabled={disabled}>
          <Type size={15} />
          <span>文字</span>
        </ToolBtn>
        <ToolBtn title="在后方插入空白页" onClick={pdf.onInsertPage} disabled={disabled}>
          <FilePlus2 size={15} />
          <span>插页</span>
        </ToolBtn>
        <ToolBtn
          title="删除当前页"
          onClick={pdf.onDeletePage}
          disabled={disabled || pdf.pageCount <= 1}
        >
          <Trash2 size={15} />
          <span>删页</span>
        </ToolBtn>
        <ToolBtn title="上移本页" onClick={pdf.onMoveUp} disabled={disabled || pdf.page <= 1}>
          <ArrowUp size={15} />
        </ToolBtn>
        <ToolBtn
          title="下移本页"
          onClick={pdf.onMoveDown}
          disabled={disabled || pdf.page >= pdf.pageCount}
        >
          <ArrowDown size={15} />
        </ToolBtn>
        <Sep />
        <ToolBtn title="打印" onClick={pdf.onPrint} disabled={disabled}>
          <Printer size={15} />
        </ToolBtn>
        <span className="format-hint">PDF 编辑</span>
      </div>
    )
  }

  if (kind === 'excel' && excel) {
    return (
      <div className="format-toolbar">
        <ToolBtn title="插入行" onClick={excel.addRow}>
          <Plus size={15} />
          <span>行</span>
        </ToolBtn>
        <ToolBtn title="插入列" onClick={excel.addCol}>
          <Plus size={15} />
          <span>列</span>
        </ToolBtn>
        <Sep />
        <ToolBtn title="删除末行" onClick={excel.removeRow}>
          <Minus size={15} />
          <span>行</span>
        </ToolBtn>
        <ToolBtn title="删除末列" onClick={excel.removeCol}>
          <Minus size={15} />
          <span>列</span>
        </ToolBtn>
        <span className="format-hint">表格编辑</span>
      </div>
    )
  }

  if (kind === 'word') {
    const run = (cmd: string, value?: string) => {
      document.execCommand(cmd, false, value)
    }
    return (
      <div className="format-toolbar">
        <ToolBtn title="加粗" onClick={() => run('bold')} disabled={wordLegacy}>
          <Bold size={15} />
        </ToolBtn>
        <ToolBtn title="斜体" onClick={() => run('italic')} disabled={wordLegacy}>
          <Italic size={15} />
        </ToolBtn>
        <ToolBtn title="下划线" onClick={() => run('underline')} disabled={wordLegacy}>
          <Underline size={15} />
        </ToolBtn>
        <ToolBtn title="删除线" onClick={() => run('strikeThrough')} disabled={wordLegacy}>
          <Strikethrough size={15} />
        </ToolBtn>
        <Sep />
        <ToolBtn title="标题 1" onClick={() => run('formatBlock', 'h1')} disabled={wordLegacy}>
          <Heading1 size={15} />
        </ToolBtn>
        <ToolBtn title="标题 2" onClick={() => run('formatBlock', 'h2')} disabled={wordLegacy}>
          <Heading2 size={15} />
        </ToolBtn>
        <ToolBtn title="无序列表" onClick={() => run('insertUnorderedList')} disabled={wordLegacy}>
          <List size={15} />
        </ToolBtn>
        <ToolBtn title="有序列表" onClick={() => run('insertOrderedList')} disabled={wordLegacy}>
          <ListOrdered size={15} />
        </ToolBtn>
        <Sep />
        <ToolBtn
          title="链接"
          onClick={() => {
            const url = window.prompt('链接地址', 'https://')
            if (url) run('createLink', url)
          }}
          disabled={wordLegacy}
        >
          <Link size={15} />
        </ToolBtn>
        <span className="format-hint">{wordLegacy ? '旧版 .doc（简易文本）' : 'Word'}</span>
      </div>
    )
  }

  // Markdown
  const bridge = () => getEditorBridge()
  return (
    <div className="format-toolbar">
      <ToolBtn title="加粗 ⌘B" onClick={() => bridge()?.applyFormat('bold')}>
        <Bold size={15} />
      </ToolBtn>
      <ToolBtn title="斜体 ⌘I" onClick={() => bridge()?.applyFormat('italic')}>
        <Italic size={15} />
      </ToolBtn>
      <ToolBtn title="删除线" onClick={() => bridge()?.applyFormat('strike')}>
        <Strikethrough size={15} />
      </ToolBtn>
      <ToolBtn title="行内代码" onClick={() => bridge()?.applyFormat('inline-code')}>
        <Code size={15} />
      </ToolBtn>
      <ToolBtn title="链接 ⌘K" onClick={() => bridge()?.applyFormat('link')}>
        <Link size={15} />
      </ToolBtn>
      <Sep />
      <ToolBtn title="标题 1" onClick={() => bridge()?.applyFormat('heading', 1)}>
        <Heading1 size={15} />
      </ToolBtn>
      <ToolBtn title="标题 2" onClick={() => bridge()?.applyFormat('heading', 2)}>
        <Heading2 size={15} />
      </ToolBtn>
      <ToolBtn title="标题 3" onClick={() => bridge()?.applyFormat('heading', 3)}>
        <Heading3 size={15} />
      </ToolBtn>
      <Sep />
      <ToolBtn title="无序列表" onClick={() => bridge()?.applyFormat('ul')}>
        <List size={15} />
      </ToolBtn>
      <ToolBtn title="有序列表" onClick={() => bridge()?.applyFormat('ol')}>
        <ListOrdered size={15} />
      </ToolBtn>
      <ToolBtn title="任务列表" onClick={() => bridge()?.applyFormat('task')}>
        <CheckSquare size={15} />
      </ToolBtn>
      <ToolBtn title="引用" onClick={() => bridge()?.applyFormat('quote')}>
        <Quote size={15} />
      </ToolBtn>
      <ToolBtn title="代码块" onClick={() => bridge()?.applyFormat('code-block')}>
        <SquareCode size={15} />
      </ToolBtn>
      <ToolBtn
        title="表格"
        onClick={() =>
          bridge()?.applyFormat(
            'insert-md',
            '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |\n',
          )
        }
      >
        <Table size={15} />
      </ToolBtn>
      <span className="format-hint">Markdown</span>
    </div>
  )
}
