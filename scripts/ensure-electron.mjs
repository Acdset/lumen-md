#!/usr/bin/env node
/**
 * Ensure Electron binary is extracted. Some mirrors/caches leave path.txt
 * without a complete dist; this script repairs that.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const electronDir = path.join(root, 'node_modules', 'electron')
const distDir = path.join(electronDir, 'dist')
const framework = path.join(
  distDir,
  'Electron.app',
  'Contents',
  'Frameworks',
  'Electron Framework.framework',
)
const pathTxt = path.join(electronDir, 'path.txt')

if (!fs.existsSync(electronDir)) {
  console.log('[ensure-electron] electron package missing, skip')
  process.exit(0)
}

if (fs.existsSync(framework)) {
  fs.writeFileSync(pathTxt, 'Electron.app/Contents/MacOS/Electron')
  process.exit(0)
}

console.log('[ensure-electron] Electron framework missing, reinstalling…')
process.env.ELECTRON_MIRROR ||= 'https://npmmirror.com/mirrors/electron/'
try {
  execSync('node install.js', { cwd: electronDir, stdio: 'inherit', env: process.env })
} catch {
  console.warn('[ensure-electron] install.js failed; try extracting from cache')
}

if (!fs.existsSync(framework)) {
  const cacheRoot = path.join(process.env.HOME || '', 'Library/Caches/electron')
  if (fs.existsSync(cacheRoot)) {
    const zips = []
    for (const dir of fs.readdirSync(cacheRoot)) {
      const full = path.join(cacheRoot, dir)
      if (!fs.statSync(full).isDirectory()) continue
      for (const f of fs.readdirSync(full)) {
        if (/electron-v.*-darwin-arm64\.zip$/.test(f) || /electron-v.*-darwin-x64\.zip$/.test(f)) {
          zips.push(path.join(full, f))
        }
      }
    }
    zips.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    if (zips[0]) {
      fs.rmSync(distDir, { recursive: true, force: true })
      fs.mkdirSync(distDir, { recursive: true })
      execSync(`unzip -q "${zips[0]}" -d "${distDir}"`, { stdio: 'inherit' })
    }
  }
}

if (fs.existsSync(framework)) {
  fs.writeFileSync(pathTxt, 'Electron.app/Contents/MacOS/Electron')
  console.log('[ensure-electron] OK')
} else {
  console.warn('[ensure-electron] still incomplete — run: npm rebuild electron')
}
