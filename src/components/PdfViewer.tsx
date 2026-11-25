import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { base64ToArrayBuffer } from '@/lib/office'
import {
  addTextToPdfPage,
  deletePdfPage,
  insertBlankPdfPage,
  movePdfPage,
  rotatePdfPage,
} from '@/lib/pdfEdit'

type PdfDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<{
    getViewport: (params: { scale: number }) => { width: number; height: number }
    render: (params: {
      canvasContext: CanvasRenderingContext2D
      viewport: { width: number; height: number }
      canvas: HTMLCanvasElement
      transform?: number[]
    }) => { promise: Promise<void> }
  }>
  destroy?: () => Promise<void>
}

function assetBase() {
  return new URL('./pdfjs/', window.location.href).href
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const base = assetBase()
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', base).href
  return { pdfjs, base }
}

export type PdfViewerHandle = {
  prev: () => void
  next: () => void
  zoomIn: () => void
  zoomOut: () => void
  print: () => void
  rotatePage: () => void
  deletePage: () => void
  insertPage: () => void
  movePageUp: () => void
  movePageDown: () => void
  addText: () => void
  page: number
  pageCount: number
  scale: number
  busy: boolean
}

type Props = {
  base64: string
  onChange?: (nextBase64: string, preferPage?: number) => void
  onMeta?: (meta: { page: number; pageCount: number; scale: number; busy: boolean }) => void
}

type TextComposer = {
  text: string
  /** 已确认文字，等待点击页面落点 */
  placing: boolean
}

export const PdfViewer = forwardRef<PdfViewerHandle, Props>(function PdfViewer(
  { base64, onChange, onMeta },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pendingPage, setPendingPage] = useState<number | null>(null)
  const [composer, setComposer] = useState<TextComposer | null>(null)
  const pdfRef = useRef<PdfDocument | null>(null)
  const renderGen = useRef(0)
  const base64Ref = useRef(base64)
  base64Ref.current = base64

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setPageCount(0)
      pdfRef.current = null
      try {
        const { pdfjs, base } = await loadPdfjs()
        const data = new Uint8Array(base64ToArrayBuffer(base64))
        const docOptions = {
          data,
          useSystemFonts: true,
          cMapUrl: new URL('cmaps/', base).href,
          cMapPacked: true,
          standardFontDataUrl: new URL('standard_fonts/', base).href,
          wasmUrl: new URL('wasm/', base).href,
        }
        const pdf = (await pdfjs.getDocument(docOptions).promise) as unknown as PdfDocument
        if (cancelled) {
          void pdf.destroy?.()
          return
        }
        pdfRef.current = pdf
        setPageCount(pdf.numPages)
        setPage((prev) => {
          if (pendingPage != null) {
            return Math.min(Math.max(1, pendingPage), pdf.numPages)
          }
          return Math.min(Math.max(1, prev), pdf.numPages)
        })
        setPendingPage(null)
        setLoading(false)
      } catch (err) {
        console.error('[Lumen] pdf load failed', err)
        if (!cancelled) {
          pdfRef.current = null
          setPageCount(0)
          setLoading(false)
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }
    void load()
    return () => {
      cancelled = true
      void pdfRef.current?.destroy?.()
      pdfRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base64])

  useEffect(() => {
    const gen = ++renderGen.current
    const render = async () => {
      const pdf = pdfRef.current
      const canvas = canvasRef.current
      if (!pdf || !canvas || page < 1 || pageCount < 1) return
      try {
        const pdfPage = await pdf.getPage(page)
        if (gen !== renderGen.current) return
        const viewport = pdfPage.getViewport({ scale })
        const context = canvas.getContext('2d')
        if (!context) return
        const outputScale = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
        await pdfPage
          .render({
            canvasContext: context,
            viewport,
            canvas,
            ...(transform ? { transform } : {}),
          })
          .promise
        if (gen !== renderGen.current) return
        onMeta?.({ page, pageCount: pdf.numPages, scale, busy })
      } catch (err) {
        console.error('[Lumen] pdf render failed', err)
        if (gen === renderGen.current) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }
    void render()
  }, [page, scale, pageCount, onMeta, base64, busy])

  useEffect(() => {
    onMeta?.({ page, pageCount, scale, busy })
  }, [page, pageCount, scale, busy, onMeta])

  useEffect(() => {
    if (composer && !composer.placing) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 30)
      return () => window.clearTimeout(id)
    }
  }, [composer])

  const runEdit = async (
    editor: (b64: string, pageIndex0: number) => Promise<string>,
    preferPage?: number,
  ) => {
    if (busy) return
    setBusy(true)
    try {
      const next = await editor(base64Ref.current, page - 1)
      setPendingPage(preferPage ?? page)
      onChange?.(next, preferPage ?? page)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'PDF 编辑失败')
    } finally {
      setBusy(false)
    }
  }

  const beginAddText = () => {
    if (busy || loading || error) return
    setComposer({ text: '', placing: false })
  }

  const cancelComposer = () => setComposer(null)

  const startPlacing = () => {
    if (!composer) return
    const text = composer.text.trim()
    if (!text) return
    setComposer({ text, placing: true })
  }

  const insertAtCenter = () => {
    if (!composer) return
    const text = composer.text.trim()
    if (!text) return
    setComposer(null)
    void runEdit((b64, idx) => addTextToPdfPage(b64, idx, text))
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!composer?.placing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const xNorm = (e.clientX - rect.left) / rect.width
    const yNorm = (e.clientY - rect.top) / rect.height
    const text = composer.text.trim()
    setComposer(null)
    void runEdit((b64, idx) => addTextToPdfPage(b64, idx, text, { xNorm, yNorm }))
  }

  useImperativeHandle(
    ref,
    () => ({
      prev: () => setPage((p) => Math.max(1, p - 1)),
      next: () => setPage((p) => Math.min(pageCount || p, p + 1)),
      zoomIn: () => setScale((s) => Math.min(3, +(s + 0.15).toFixed(2))),
      zoomOut: () => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2))),
      print: () => window.print(),
      rotatePage: () => {
        void runEdit(rotatePdfPage)
      },
      deletePage: () => {
        if (pageCount <= 1) {
          window.alert('至少保留一页')
          return
        }
        void (async () => {
          const ok = window.lumen?.confirm
            ? await window.lumen.confirm({
                title: '删除页面',
                message: `确定删除第 ${page} 页吗？`,
                dangerous: true,
              })
            : window.confirm(`确定删除第 ${page} 页吗？`)
          if (!ok) return
          void runEdit(deletePdfPage, Math.max(1, page - 1))
        })()
      },
      insertPage: () => {
        void runEdit(insertBlankPdfPage, page + 1)
      },
      movePageUp: () => {
        if (page <= 1) return
        void runEdit((b64, idx) => movePdfPage(b64, idx, -1), page - 1)
      },
      movePageDown: () => {
        if (page >= pageCount) return
        void runEdit((b64, idx) => movePdfPage(b64, idx, 1), page + 1)
      },
      addText: beginAddText,
      page,
      pageCount,
      scale,
      busy,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, pageCount, scale, busy, loading, error],
  )

  return (
    <div className="office-pane pdf-pane">
      {error ? (
        <div className="pdf-error">
          <p>无法打开 PDF</p>
          <p className="pdf-error-detail">{error}</p>
        </div>
      ) : (
        <div className={`pdf-stage ${composer?.placing ? 'is-placing' : ''}`}>
          {(loading || busy) && (
            <div className="pdf-loading">{busy ? '正在应用编辑…' : '正在加载 PDF…'}</div>
          )}

          {composer && (
            <div className="pdf-text-composer" onClick={(e) => e.stopPropagation()}>
              {composer.placing ? (
                <>
                  <span className="pdf-text-composer-hint">点击页面放置「{composer.text}」</span>
                  <button type="button" className="pdf-text-composer-btn" onClick={cancelComposer}>
                    取消
                  </button>
                </>
              ) : (
                <>
                  <input
                    ref={inputRef}
                    className="pdf-text-composer-input"
                    value={composer.text}
                    placeholder="输入要添加的文字（支持中文）"
                    onChange={(e) => setComposer({ text: e.target.value, placing: false })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelComposer()
                      } else if (e.key === 'Enter') {
                        e.preventDefault()
                        startPlacing()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="pdf-text-composer-btn primary"
                    disabled={!composer.text.trim()}
                    onClick={startPlacing}
                  >
                    点击放置
                  </button>
                  <button
                    type="button"
                    className="pdf-text-composer-btn"
                    disabled={!composer.text.trim()}
                    onClick={insertAtCenter}
                  >
                    居中插入
                  </button>
                  <button type="button" className="pdf-text-composer-btn" onClick={cancelComposer}>
                    取消
                  </button>
                </>
              )}
            </div>
          )}

          <canvas
            ref={canvasRef}
            className={`pdf-canvas ${composer?.placing ? 'is-placing' : ''}`}
            hidden={loading}
            onClick={handleCanvasClick}
          />
        </div>
      )}
    </div>
  )
})
