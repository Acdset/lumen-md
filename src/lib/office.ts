import type { ExcelSheetData } from '@/store/appStore'
import type { DocumentKind } from '@/lib/documentKind'

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function extractDocText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer)
  const chunks: string[] = []
  let current = ''
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i]
    if (b >= 32 && b < 127) {
      current += String.fromCharCode(b)
    } else if (b === 0 && current.length > 24) {
      chunks.push(current.trim())
      current = ''
    } else {
      if (current.length > 40) chunks.push(current.trim())
      current = ''
    }
  }
  if (current.length > 40) chunks.push(current.trim())
  const joined = chunks.join('\n').replace(/\s+/g, ' ').trim()
  return joined || '（无法解析此 .doc 文件，请另存为 .docx 后打开）'
}

export async function parseWordDocument(base64: string, fileName: string) {
  const buffer = base64ToArrayBuffer(base64)
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
    const text = await extractDocText(buffer)
    const html = text
      .split(/\n+/)
      .map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`)
      .join('')
    return { html, readOnlyLegacy: true }
  }
  const mammoth = await import('mammoth')
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
  return { html: result.value || '<p><br></p>', readOnlyLegacy: false }
}

/** Word 保存走主进程（html-to-docx 依赖 Node API，不能进渲染进程） */
export async function htmlToDocxBase64(html: string, title: string): Promise<string> {
  const api = window.lumen
  if (!api?.htmlToDocx) {
    throw new Error('Word 导出不可用：原生桥接未就绪')
  }
  return api.htmlToDocx(html, title)
}

export async function parseExcelDocument(base64: string): Promise<ExcelSheetData[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(base64ToArrayBuffer(base64), { type: 'array' })
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as (string | number | boolean | null)[][]
    const normalized = rows.map((row) => {
      const cells = row.map((cell) => (cell == null ? '' : String(cell)))
      return cells.length ? cells : ['']
    })
    while (normalized.length < 20) {
      normalized.push(Array(Math.max(normalized[0]?.length || 8, 8)).fill(''))
    }
    const colCount = Math.max(8, ...normalized.map((r) => r.length))
    return {
      name,
      rows: normalized.map((r) => {
        const next = [...r]
        while (next.length < colCount) next.push('')
        return next
      }),
    }
  })
}

export async function excelSheetsToBase64(sheets: ExcelSheetData[]): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows)
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name.slice(0, 31) || 'Sheet')
  }
  const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array
  const copy = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)
  return arrayBufferToBase64(copy instanceof ArrayBuffer ? copy : new Uint8Array(out).buffer)
}

export async function loadOfficeFromDocument(doc: {
  path: string
  kind: DocumentKind
  content: string
  base64?: string
  mime?: string
}) {
  if (doc.kind === 'word' && doc.base64) {
    const { html, readOnlyLegacy } = await parseWordDocument(doc.base64, doc.path)
    return {
      content: '',
      html,
      sheets: [] as ExcelSheetData[],
      base64: doc.base64,
      mime: undefined as string | undefined,
      readOnlyLegacy,
    }
  }
  if (doc.kind === 'excel' && doc.base64) {
    const sheets = await parseExcelDocument(doc.base64)
    return {
      content: '',
      html: '',
      sheets,
      base64: doc.base64,
      mime: undefined as string | undefined,
      readOnlyLegacy: false,
    }
  }
  if ((doc.kind === 'pdf' || doc.kind === 'image') && doc.base64) {
    return {
      content: '',
      html: '',
      sheets: [] as ExcelSheetData[],
      base64: doc.base64,
      mime: doc.mime,
      readOnlyLegacy: true,
    }
  }
  return {
    content: doc.content,
    html: '',
    sheets: [] as ExcelSheetData[],
    base64: doc.base64,
    mime: doc.mime,
    readOnlyLegacy: false,
  }
}
