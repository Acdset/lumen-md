import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { mimeForImagePath } from '@/lib/documentKind'
import {
  canvasToBase64,
  cropImageToCanvas,
  exportMimeFor,
  loadImageFromSrc,
  resizeImageToCanvas,
  rotateImageToCanvas,
  type CropRect,
} from '@/lib/imageEdit'

export type ImageViewerHandle = {
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
  fit: () => void
  rotate: () => void
  startCrop: () => void
  cancelCrop: () => void
  applyCrop: () => void
  openResize: () => void
  cropping: boolean
  scale: number
  naturalWidth: number
  naturalHeight: number
}

type Props = {
  base64: string
  fileName: string
  mime?: string | null
  onChange?: (next: { base64: string; mime: string }) => void
  onMeta?: (meta: {
    scale: number
    rotation: number
    naturalWidth: number
    naturalHeight: number
    cropping: boolean
  }) => void
}

type DragState = {
  startX: number
  startY: number
  origin: CropRect
}

export const ImageViewer = forwardRef<ImageViewerHandle, Props>(function ImageViewer(
  { base64, fileName, mime, onChange, onMeta },
  ref,
) {
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [scale, setScale] = useState(1)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [error, setError] = useState<string | null>(null)
  const [fitMode, setFitMode] = useState(true)
  const [cropping, setCropping] = useState(false)
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [resizeOpen, setResizeOpen] = useState(false)
  const [resizeW, setResizeW] = useState('')
  const [resizeH, setResizeH] = useState('')
  const [keepRatio, setKeepRatio] = useState(true)
  const [busy, setBusy] = useState(false)
  const dragRef = useRef<DragState | null>(null)

  const src = useMemo(() => {
    const resolved = mime || mimeForImagePath(fileName)
    return `data:${resolved};base64,${base64}`
  }, [base64, fileName, mime])

  const applyFit = useCallback(() => {
    const stage = stageRef.current
    const img = imgRef.current
    if (!stage || !img || !img.naturalWidth) return
    const pad = 48
    const availW = Math.max(120, stage.clientWidth - pad)
    const availH = Math.max(120, stage.clientHeight - pad)
    const next = Math.min(1, availW / img.naturalWidth, availH / img.naturalHeight)
    setScale(+next.toFixed(3))
    setFitMode(true)
  }, [])

  useEffect(() => {
    setScale(1)
    setFitMode(true)
    setError(null)
    setCropping(false)
    setCrop(null)
    setResizeOpen(false)
    setNatural({ w: 0, h: 0 })
  }, [base64, fileName])

  useEffect(() => {
    onMeta?.({
      scale,
      rotation: 0,
      naturalWidth: natural.w,
      naturalHeight: natural.h,
      cropping,
    })
  }, [scale, natural, cropping, onMeta])

  useEffect(() => {
    if (!fitMode) return
    const onResize = () => applyFit()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fitMode, natural.w, natural.h, applyFit])

  const commitCanvas = async (canvas: HTMLCanvasElement) => {
    const outMime = exportMimeFor(fileName, mime)
    const nextBase64 = await canvasToBase64(canvas, outMime)
    onChange?.({ base64: nextBase64, mime: outMime })
  }

  const bakeRotate = async () => {
    if (busy || !natural.w) return
    setBusy(true)
    try {
      const img = await loadImageFromSrc(src)
      const canvas = rotateImageToCanvas(img, img.naturalWidth, img.naturalHeight, 90)
      await commitCanvas(canvas)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '旋转失败')
    } finally {
      setBusy(false)
    }
  }

  const startCrop = () => {
    if (!natural.w || !natural.h) return
    setCropping(true)
    setCrop({
      x: Math.round(natural.w * 0.1),
      y: Math.round(natural.h * 0.1),
      w: Math.round(natural.w * 0.8),
      h: Math.round(natural.h * 0.8),
    })
  }

  const cancelCrop = () => {
    setCropping(false)
    setCrop(null)
  }

  const applyCrop = async () => {
    if (!crop || busy) return
    setBusy(true)
    try {
      const img = await loadImageFromSrc(src)
      const canvas = cropImageToCanvas(img, img.naturalWidth, img.naturalHeight, crop)
      setCropping(false)
      setCrop(null)
      await commitCanvas(canvas)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '裁剪失败')
    } finally {
      setBusy(false)
    }
  }

  const openResize = () => {
    setResizeW(String(natural.w || ''))
    setResizeH(String(natural.h || ''))
    setKeepRatio(true)
    setResizeOpen(true)
  }

  const applyResize = async () => {
    const w = Number(resizeW)
    const h = Number(resizeH)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
      window.alert('请输入有效的宽度和高度（至少为 1）')
      return
    }
    if (w > 10000 || h > 10000) {
      window.alert('尺寸过大，请控制在 10000 像素以内')
      return
    }
    setBusy(true)
    try {
      const img = await loadImageFromSrc(src)
      const canvas = resizeImageToCanvas(img, img.naturalWidth, img.naturalHeight, w, h)
      setResizeOpen(false)
      await commitCanvas(canvas)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '调整大小失败')
    } finally {
      setBusy(false)
    }
  }

  const clientToImage = (clientX: number, clientY: number) => {
    const frame = frameRef.current
    if (!frame || !natural.w) return { x: 0, y: 0 }
    const rect = frame.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * natural.w
    const y = ((clientY - rect.top) / rect.height) * natural.h
    return {
      x: Math.max(0, Math.min(natural.w, x)),
      y: Math.max(0, Math.min(natural.h, y)),
    }
  }

  const onCropPointerDown = (e: ReactMouseEvent) => {
    if (!cropping) return
    e.preventDefault()
    const p = clientToImage(e.clientX, e.clientY)
    const next = { x: p.x, y: p.y, w: 1, h: 1 }
    setCrop(next)
    dragRef.current = { startX: p.x, startY: p.y, origin: next }
  }

  useEffect(() => {
    if (!cropping) return
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const p = clientToImage(e.clientX, e.clientY)
      const x1 = Math.min(drag.startX, p.x)
      const y1 = Math.min(drag.startY, p.y)
      const x2 = Math.max(drag.startX, p.x)
      const y2 = Math.max(drag.startY, p.y)
      setCrop({
        x: x1,
        y: y1,
        w: Math.max(1, x2 - x1),
        h: Math.max(1, y2 - y1),
      })
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropping, natural.w, natural.h])

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        setFitMode(false)
        setScale((s) => Math.min(8, +(s * 1.2).toFixed(3)))
      },
      zoomOut: () => {
        setFitMode(false)
        setScale((s) => Math.max(0.05, +(s / 1.2).toFixed(3)))
      },
      resetView: () => {
        setFitMode(false)
        setScale(1)
      },
      fit: () => {
        setFitMode(true)
        requestAnimationFrame(applyFit)
      },
      rotate: () => {
        void bakeRotate()
      },
      startCrop,
      cancelCrop,
      applyCrop: () => {
        void applyCrop()
      },
      openResize,
      cropping,
      scale,
      naturalWidth: natural.w,
      naturalHeight: natural.h,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, natural, cropping, fitMode, src, busy, crop, resizeW, resizeH],
  )

  const cropStyle = crop
    ? {
        left: `${(crop.x / Math.max(natural.w, 1)) * 100}%`,
        top: `${(crop.y / Math.max(natural.h, 1)) * 100}%`,
        width: `${(crop.w / Math.max(natural.w, 1)) * 100}%`,
        height: `${(crop.h / Math.max(natural.h, 1)) * 100}%`,
      }
    : undefined

  return (
    <div className="office-pane image-pane" ref={stageRef}>
      {error ? (
        <div className="image-error">
          <p>无法预览此图片</p>
          <p className="image-error-detail">{error}</p>
        </div>
      ) : (
        <div className={`image-stage ${cropping ? 'is-cropping' : ''}`}>
          <div
            className="image-frame"
            ref={frameRef}
            style={{ transform: `scale(${scale})` }}
            onMouseDown={onCropPointerDown}
          >
            <img
              ref={imgRef}
              className="image-preview"
              src={src}
              alt={fileName}
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget
                setNatural({ w: el.naturalWidth, h: el.naturalHeight })
                requestAnimationFrame(applyFit)
              }}
              onError={() => {
                setError('浏览器无法解码该格式（如 HEIC 可能需系统预览）。')
              }}
            />
            {cropping && crop && (
              <div className="image-crop-rect" style={cropStyle}>
                <span className="image-crop-size">
                  {Math.round(crop.w)}×{Math.round(crop.h)}
                </span>
              </div>
            )}
          </div>
          {cropping && (
            <div className="image-crop-hint">拖拽选择裁剪区域，然后点工具栏「应用裁剪」</div>
          )}
        </div>
      )}

      {resizeOpen && (
        <div className="image-modal-backdrop" onClick={() => setResizeOpen(false)} role="presentation">
          <div
            className="image-modal"
            role="dialog"
            aria-label="调整图片大小"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>调整大小</h3>
            <p className="image-modal-desc">
              当前 {natural.w}×{natural.h} 像素
            </p>
            <label className="image-modal-row">
              <span>宽度</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={resizeW}
                onChange={(e) => {
                  const next = e.target.value
                  setResizeW(next)
                  if (keepRatio && natural.w && natural.h) {
                    const w = Number(next)
                    if (Number.isFinite(w) && w > 0) {
                      setResizeH(String(Math.max(1, Math.round((w * natural.h) / natural.w))))
                    }
                  }
                }}
              />
            </label>
            <label className="image-modal-row">
              <span>高度</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={resizeH}
                onChange={(e) => {
                  const next = e.target.value
                  setResizeH(next)
                  if (keepRatio && natural.w && natural.h) {
                    const h = Number(next)
                    if (Number.isFinite(h) && h > 0) {
                      setResizeW(String(Math.max(1, Math.round((h * natural.w) / natural.h))))
                    }
                  }
                }}
              />
            </label>
            <label className="image-modal-check">
              <input
                type="checkbox"
                checked={keepRatio}
                onChange={(e) => setKeepRatio(e.target.checked)}
              />
              保持宽高比
            </label>
            <div className="image-modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setResizeOpen(false)}>
                取消
              </button>
              <button type="button" className="primary-btn" onClick={() => void applyResize()} disabled={busy}>
                应用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
