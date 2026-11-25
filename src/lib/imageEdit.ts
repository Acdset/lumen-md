import { mimeForImagePath } from '@/lib/documentKind'

export type CropRect = { x: number; y: number; w: number; h: number }

export function exportMimeFor(fileName: string, currentMime?: string | null) {
  const mime = (currentMime || mimeForImagePath(fileName)).toLowerCase()
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'image/jpeg'
  if (mime.includes('webp')) return 'image/webp'
  if (mime.includes('png')) return 'image/png'
  // svg / heic / tiff 等编辑后统一导出 png
  return 'image/png'
}

export function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

export async function canvasToBase64(
  canvas: HTMLCanvasElement,
  mime: string,
  quality = 0.92,
): Promise<string> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, quality),
  )
  if (!blob) throw new Error('无法导出图片')
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** 将图片按角度（90 的倍数）旋转后画到新画布 */
export function rotateImageToCanvas(img: CanvasImageSource, width: number, height: number, deg: number) {
  const angle = ((deg % 360) + 360) % 360
  const swap = angle === 90 || angle === 270
  const canvas = document.createElement('canvas')
  canvas.width = swap ? height : width
  canvas.height = swap ? width : height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((angle * Math.PI) / 180)
  ctx.drawImage(img, -width / 2, -height / 2, width, height)
  return canvas
}

export function cropImageToCanvas(
  img: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  crop: CropRect,
) {
  const x = Math.max(0, Math.min(sourceW - 1, Math.round(crop.x)))
  const y = Math.max(0, Math.min(sourceH - 1, Math.round(crop.y)))
  const w = Math.max(1, Math.min(sourceW - x, Math.round(crop.w)))
  const h = Math.max(1, Math.min(sourceH - y, Math.round(crop.h)))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h)
  return canvas
}

export function resizeImageToCanvas(
  img: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  targetW: number,
  targetH: number,
) {
  const w = Math.max(1, Math.round(targetW))
  const h = Math.max(1, Math.round(targetH))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, sourceW, sourceH, 0, 0, w, h)
  return canvas
}
