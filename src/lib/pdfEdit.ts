import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/lib/office'

async function loadDoc(base64: string) {
  const bytes = new Uint8Array(base64ToArrayBuffer(base64))
  return PDFDocument.load(bytes, { ignoreEncryption: true })
}

async function saveDoc(doc: PDFDocument) {
  const out = await doc.save({ useObjectStreams: false })
  return arrayBufferToBase64(
    out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer,
  )
}

/** Helvetica/WinAnsi 无法编码的字符（中文等）需要自定义字体 */
function needsCustomFont(text: string) {
  for (const ch of text) {
    if (ch.charCodeAt(0) > 255) return true
  }
  return false
}

let cjkFontBytesPromise: Promise<Uint8Array> | null = null

async function loadCjkFontBytes(): Promise<Uint8Array> {
  if (!cjkFontBytesPromise) {
    cjkFontBytesPromise = (async () => {
      if (typeof window === 'undefined' || !window.lumen?.readCjkFont) {
        throw new Error('无法加载中文字体：原生桥接未就绪')
      }
      const raw = await window.lumen.readCjkFont()
      return raw instanceof Uint8Array ? raw : new Uint8Array(raw)
    })().catch((err) => {
      cjkFontBytesPromise = null
      throw err
    })
  }
  return cjkFontBytesPromise
}

/** 旋转当前页（顺时针 90°） */
export async function rotatePdfPage(base64: string, pageIndex0: number) {
  const doc = await loadDoc(base64)
  const page = doc.getPage(pageIndex0)
  const current = page.getRotation().angle
  page.setRotation(degrees((current + 90) % 360))
  return saveDoc(doc)
}

/** 删除当前页；若只剩一页则抛错 */
export async function deletePdfPage(base64: string, pageIndex0: number) {
  const doc = await loadDoc(base64)
  if (doc.getPageCount() <= 1) throw new Error('至少保留一页')
  doc.removePage(pageIndex0)
  return saveDoc(doc)
}

/** 在当前页后插入空白页 */
export async function insertBlankPdfPage(base64: string, afterIndex0: number) {
  const doc = await loadDoc(base64)
  const ref = doc.getPage(Math.max(0, Math.min(afterIndex0, doc.getPageCount() - 1)))
  const { width, height } = ref.getSize()
  doc.insertPage(afterIndex0 + 1, [width, height])
  return saveDoc(doc)
}

/** 将当前页与相邻页交换（dir: -1 上移 / 1 下移） */
export async function movePdfPage(base64: string, pageIndex0: number, dir: -1 | 1) {
  const doc = await loadDoc(base64)
  const count = doc.getPageCount()
  const target = pageIndex0 + dir
  if (target < 0 || target >= count) return base64

  const indices = Array.from({ length: count }, (_, i) => i)
  const tmp = indices[pageIndex0]
  indices[pageIndex0] = indices[target]
  indices[target] = tmp

  const next = await PDFDocument.create()
  const copied = await next.copyPages(doc, indices)
  for (const page of copied) next.addPage(page)
  return saveDoc(next)
}

export type AddPdfTextOptions = {
  /** 相对页宽 0–1，原点左上 */
  xNorm?: number
  /** 相对页高 0–1，原点左上 */
  yNorm?: number
  size?: number
}

/** 在页面添加文字（支持中文；可按归一化坐标落点） */
export async function addTextToPdfPage(
  base64: string,
  pageIndex0: number,
  text: string,
  opts: AddPdfTextOptions = {},
) {
  const doc = await loadDoc(base64)
  const page = doc.getPage(pageIndex0)
  const size = opts.size ?? 16
  const { width, height } = page.getSize()

  let font
  if (needsCustomFont(text)) {
    doc.registerFontkit(fontkit)
    const fontBytes = await loadCjkFontBytes()
    font = await doc.embedFont(fontBytes, { subset: true })
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica)
  }

  const textWidth = font.widthOfTextAtSize(text, size)
  const xNorm = opts.xNorm
  const yNorm = opts.yNorm
  const x =
    xNorm == null
      ? Math.max(24, (width - textWidth) / 2)
      : Math.min(Math.max(8, xNorm * width), Math.max(8, width - 8))
  const y =
    yNorm == null
      ? height / 2
      : Math.min(Math.max(size, height - yNorm * height - size * 0.2), height - 8)

  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0.12, 0.12, 0.12),
  })
  return saveDoc(doc)
}
