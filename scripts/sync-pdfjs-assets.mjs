import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'node_modules', 'pdfjs-dist')
const dest = path.join(root, 'public', 'pdfjs')

// Electron Chromium < 140 必须用 legacy worker（含 toHex 等 polyfill）
const workerSrc = path.join(src, 'legacy', 'build', 'pdf.worker.min.mjs')
if (!existsSync(workerSrc)) {
  console.warn('[sync-pdfjs] pdfjs-dist legacy worker missing, skip')
  process.exit(0)
}

mkdirSync(dest, { recursive: true })
cpSync(workerSrc, path.join(dest, 'pdf.worker.min.mjs'))
for (const dir of ['standard_fonts', 'cmaps', 'wasm']) {
  const from = path.join(src, dir)
  const to = path.join(dest, dir)
  if (!existsSync(from)) continue
  rmSync(to, { recursive: true, force: true })
  cpSync(from, to, { recursive: true })
}
console.log('[sync-pdfjs] synced legacy worker + assets -> public/pdfjs')
