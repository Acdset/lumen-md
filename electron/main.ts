import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  shell,
  nativeTheme,
  nativeImage,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
import {
  detectDocumentKind,
  isBinaryDocument,
  LISTABLE_EXT,
  type DocumentKind,
} from './documentKind'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let mainWindow: BrowserWindow | null = null
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
let cjkFontCache: Buffer | null = null

const APP_NAME = 'Lumen'

/** 优先单文件 TTF/OTF（pdf-lib + fontkit 对 TTC 支持不稳定） */
function resolveCjkFontPath(): string | null {
  const winFonts = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')
  const candidates = [
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/Library/Fonts/Arial Unicode.ttf',
    path.join(winFonts, 'msyh.ttf'),
    path.join(winFonts, 'msyhbd.ttf'),
    path.join(winFonts, 'simhei.ttf'),
    path.join(winFonts, 'simkai.ttf'),
    path.join(winFonts, 'simsun.ttc'),
    path.join(winFonts, 'msyh.ttc'),
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansSC-Regular.otf',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

/** 常见文本扩展名；无扩展名 / 点文件另有规则 */
const TEXT_EXT = LISTABLE_EXT

const TEXT_BASENAMES = new Set([
  '.zshrc',
  '.bashrc',
  '.bash_profile',
  '.zprofile',
  '.zshenv',
  '.zlogin',
  '.zlogout',
  '.profile',
  '.inputrc',
  '.vimrc',
  '.gvimrc',
  '.tmux.conf',
  '.gitconfig',
  '.gitignore',
  '.gitattributes',
  '.gitmodules',
  '.dockerignore',
  '.editorconfig',
  '.npmrc',
  '.yarnrc',
  '.nvmrc',
  '.prettierrc',
  '.eslintrc',
  '.babelrc',
  '.env',
  'Dockerfile',
  'Makefile',
  'makefile',
  'GNUmakefile',
  'Procfile',
  'Gemfile',
  'Rakefile',
  'LICENSE',
  'LICENCE',
  'COPYING',
  'AUTHORS',
  'CONTRIBUTORS',
  'README',
  'CHANGELOG',
  'CHANGES',
  'HISTORY',
  'TODO',
  'NOTES',
])

const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', '.svn', '.hg', '__pycache__', '.Trash', '.cursor'])
const SKIP_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])

const TEXT_DIALOG_EXTENSIONS = [
  'md',
  'markdown',
  'mdown',
  'mkd',
  'txt',
  'text',
  'json',
  'jsonc',
  'yml',
  'yaml',
  'toml',
  'ini',
  'conf',
  'cfg',
  'env',
  'sh',
  'bash',
  'zsh',
  'py',
  'js',
  'ts',
  'tsx',
  'jsx',
  'css',
  'html',
  'xml',
  'csv',
  'log',
  'rs',
  'go',
  'swift',
  'sql',
]

const OFFICE_DIALOG_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'xlsm']
const IMAGE_DIALOG_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'svg',
  'avif',
  'tif',
  'tiff',
  'heic',
  'heif',
]

export type OpenedDocument = {
  path: string
  kind: DocumentKind
  /** 文本内容；二进制文档为空字符串 */
  content: string
  /** 二进制文档的 base64；文本文档省略 */
  base64?: string
  /** 图片预览 MIME（如 HEIC 转 JPEG 后为 image/jpeg） */
  mime?: string
}

/** macOS 在 app ready 之前就可能触发 open-file，需提前排队 */
const pendingOpenFiles: string[] = []
let windowReadyToReceive = false

function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, '../build/icon.icns'),
    path.join(__dirname, '../build/icon.png'),
    path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
  ]
  for (const p of candidates) {
    if (p && existsSync(p)) {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) return img
    }
  }
  return undefined
}

function createWindow() {
  const icon = resolveAppIcon()
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#ffffff',
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.platform === 'darwin' && icon && app.dock) {
    app.dock.setIcon(icon)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    markWindowReady()
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  buildMenu()
}

function send(channel: string, ...args: unknown[]) {
  mainWindow?.webContents.send(channel, ...args)
}

function isKnownTextBasename(name: string) {
  if (SKIP_FILE_NAMES.has(name)) return false
  if (TEXT_BASENAMES.has(name)) return true
  if (/^\.env(\..+)?$/i.test(name)) return true
  if (TEXT_EXT.test(name)) return true
  // 无扩展名的纯文件名（如 Makefile 未列入时）
  if (!name.startsWith('.') && !path.extname(name)) return true
  return false
}

function isTextPath(filePath: string) {
  return isKnownTextBasename(path.basename(filePath))
}

/** 启发式：前 8KB 含 NUL 则视为二进制 */
async function readTextFile(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath)
  const sample = buf.subarray(0, Math.min(buf.length, 8192))
  if (sample.includes(0)) {
    throw new Error('不是文本文件（检测到二进制内容）')
  }
  return buf.toString('utf-8')
}

async function readImageDocument(filePath: string): Promise<OpenedDocument> {
  const ext = path.extname(filePath).toLowerCase()
  // Chromium 常无法直接解码 HEIC：macOS 上先用 sips 转 JPEG 预览
  if (process.platform === 'darwin' && (ext === '.heic' || ext === '.heif')) {
    const tmp = path.join(app.getPath('temp'), `lumen-preview-${Date.now()}.jpg`)
    try {
      await execFileAsync('sips', ['-s', 'format', 'jpeg', filePath, '--out', tmp])
      const buf = await fs.readFile(tmp)
      await fs.unlink(tmp).catch(() => undefined)
      return {
        path: filePath,
        kind: 'image',
        content: '',
        base64: buf.toString('base64'),
        mime: 'image/jpeg',
      }
    } catch (err) {
      console.warn('[Lumen] HEIC preview convert failed, fallback raw', err)
    }
  }
  const buf = await fs.readFile(filePath)
  return {
    path: filePath,
    kind: 'image',
    content: '',
    base64: buf.toString('base64'),
  }
}

async function openDocumentAtPath(filePath: string): Promise<OpenedDocument> {
  const kind = detectDocumentKind(filePath)
  if (kind === 'image') {
    return readImageDocument(filePath)
  }
  if (isBinaryDocument(kind)) {
    const buf = await fs.readFile(filePath)
    return {
      path: filePath,
      kind,
      content: '',
      base64: buf.toString('base64'),
    }
  }
  if (kind === 'unknown') {
    // 未知扩展名仍尝试按文本打开
    const content = await readTextFile(filePath)
    return { path: filePath, kind: 'text', content }
  }
  const content = await readTextFile(filePath)
  return { path: filePath, kind, content }
}

function collectArgvFiles(argv: string[] = process.argv): string[] {
  // 打包后: [app, ...files]；开发时: [electron, script, ...files]
  const start = app.isPackaged ? 1 : 2
  return argv.slice(start).filter((arg) => {
    if (!arg || arg.startsWith('-')) return false
    try {
      if (!existsSync(arg)) return false
      // 已知文本路径直接收；其余交由读入时二进制检测
      return true
    } catch {
      return false
    }
  })
}

function queueOpenFiles(paths: string | string[]) {
  const list = (Array.isArray(paths) ? paths : [paths]).filter((p) => {
    try {
      if (!p || !existsSync(p)) return false
      // Dock / 访达拖放文件夹：走打开文件夹而非当文件读
      return true
    } catch {
      return false
    }
  })
  for (const p of list) {
    try {
      if (statSync(p).isDirectory()) {
        void openFolderFromPath(p)
        continue
      }
    } catch {
      /* ignore */
    }
    if (!pendingOpenFiles.includes(p)) pendingOpenFiles.push(p)
  }
  void flushOpenFiles()
}

async function openFolderFromPath(dirPath: string) {
  if (!windowReadyToReceive || !mainWindow || mainWindow.isDestroyed()) {
    // 窗口未就绪时暂存为「打开文件」队列外的文件夹事件
    pendingOpenFolder = dirPath
    return
  }
  try {
    const tree = {
      root: dirPath,
      name: path.basename(dirPath),
      children: await readDirTree(dirPath),
    }
    send('app:open-folder', tree)
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  } catch (err) {
    console.error('[Lumen] open folder from path failed', dirPath, err)
  }
}

let pendingOpenFolder: string | null = null

async function flushOpenFiles() {
  if (!windowReadyToReceive || !mainWindow || mainWindow.isDestroyed()) return
  if (pendingOpenFiles.length === 0) return

  const files = pendingOpenFiles.splice(0, pendingOpenFiles.length)
  for (const filePath of files) {
    try {
      const doc = await openDocumentAtPath(filePath)
      send('app:open-file', doc)
    } catch (err) {
      console.error('[Lumen] open external file failed', filePath, err)
      dialog.showErrorBox(
        '无法打开文件',
        `${path.basename(filePath)}\n${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function markWindowReady() {
  windowReadyToReceive = true
  void flushOpenFiles()
  if (pendingOpenFolder) {
    const folder = pendingOpenFolder
    pendingOpenFolder = null
    void openFolderFromPath(folder)
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: '偏好设置…',
                accelerator: 'CmdOrCtrl+,',
                click: () => send('menu:preferences'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('menu:new'),
        },
        {
          label: '打开…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('menu:open'),
        },
        {
          label: '打开文件夹…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => send('menu:open-folder'),
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('menu:save'),
        },
        {
          label: '另存为…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('menu:save-as'),
        },
        { type: 'separator' },
        {
          label: '导出 HTML…',
          click: () => send('menu:export-html'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: '查找',
          accelerator: 'CmdOrCtrl+F',
          click: () => send('menu:find'),
        },
      ],
    },
    {
      label: '段落',
      submenu: [
        {
          label: '标题 1',
          accelerator: 'CmdOrCtrl+Alt+1',
          click: () => send('menu:heading', 1),
        },
        {
          label: '标题 2',
          accelerator: 'CmdOrCtrl+Alt+2',
          click: () => send('menu:heading', 2),
        },
        {
          label: '标题 3',
          accelerator: 'CmdOrCtrl+Alt+3',
          click: () => send('menu:heading', 3),
        },
        { type: 'separator' },
        {
          label: '无序列表',
          accelerator: 'CmdOrCtrl+Shift+U',
          click: () => send('menu:ul'),
        },
        {
          label: '有序列表',
          accelerator: 'CmdOrCtrl+Shift+7',
          click: () => send('menu:ol'),
        },
        {
          label: '任务列表',
          accelerator: 'CmdOrCtrl+Shift+9',
          click: () => send('menu:task'),
        },
        {
          label: '引用',
          accelerator: 'CmdOrCtrl+Shift+Q',
          click: () => send('menu:quote'),
        },
        {
          label: '代码块',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => send('menu:code-block'),
        },
      ],
    },
    {
      label: '格式',
      submenu: [
        {
          label: '加粗',
          accelerator: 'CmdOrCtrl+B',
          click: () => send('menu:bold'),
        },
        {
          label: '斜体',
          accelerator: 'CmdOrCtrl+I',
          click: () => send('menu:italic'),
        },
        {
          label: '删除线',
          accelerator: 'CmdOrCtrl+Shift+X',
          click: () => send('menu:strike'),
        },
        {
          label: '行内代码',
          accelerator: 'CmdOrCtrl+`',
          click: () => send('menu:inline-code'),
        },
        {
          label: '链接',
          accelerator: 'CmdOrCtrl+K',
          click: () => send('menu:link'),
        },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '切换侧边栏',
          accelerator: 'CmdOrCtrl+\\',
          click: () => send('menu:toggle-sidebar'),
        },
        {
          label: '切换大纲',
          accelerator: 'CmdOrCtrl+Shift+\\',
          click: () => send('menu:toggle-outline'),
        },
        { type: 'separator' },
        {
          label: '预览编辑',
          accelerator: 'CmdOrCtrl+1',
          click: () => send('menu:mode-wysiwyg'),
        },
        {
          label: '分栏预览',
          accelerator: 'CmdOrCtrl+2',
          click: () => send('menu:mode-live'),
        },
        {
          label: '源码模式',
          accelerator: 'CmdOrCtrl+3',
          click: () => send('menu:mode-source'),
        },
        {
          label: '切换编辑模式',
          accelerator: 'CmdOrCtrl+/',
          click: () => send('menu:toggle-source'),
        },
        { type: 'separator' },
        {
          label: '专注模式',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send('menu:focus-mode'),
        },
        {
          label: '打字机模式',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => send('menu:typewriter'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: '主题',
      submenu: [
        {
          label: '纸白',
          click: () => send('menu:theme', 'paper'),
        },
        {
          label: '夜墨',
          click: () => send('menu:theme', 'ink'),
        },
        {
          label: '羊皮',
          click: () => send('menu:theme', 'parchment'),
        },
        {
          label: '跟随系统',
          click: () => send('menu:theme', 'system'),
        },
      ],
    },
    {
      label: '窗口',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [])],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** macOS 上挂父窗口容易触发 view-bridge 中断，导致对话框无响应 */
function prepareNativeDialog() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
  if (process.platform === 'darwin') {
    app.focus({ steal: true })
  }
}

async function showOpenDialog(
  options: Electron.OpenDialogOptions,
): Promise<Electron.OpenDialogReturnValue> {
  prepareNativeDialog()
  // 不传 BrowserWindow：避免 macOS NSOpenPanel / view-bridge 挂死
  try {
    return await dialog.showOpenDialog(options)
  } catch (err) {
    console.error('[dialog] showOpenDialog failed, retry with parent', err)
    if (mainWindow && !mainWindow.isDestroyed()) {
      return dialog.showOpenDialog(mainWindow, options)
    }
    throw err
  }
}

async function showSaveDialog(
  options: Electron.SaveDialogOptions,
): Promise<Electron.SaveDialogReturnValue> {
  prepareNativeDialog()
  try {
    return await dialog.showSaveDialog(options)
  } catch (err) {
    console.error('[dialog] showSaveDialog failed, retry with parent', err)
    if (mainWindow && !mainWindow.isDestroyed()) {
      return dialog.showSaveDialog(mainWindow, options)
    }
    throw err
  }
}

async function openFileDialog(): Promise<OpenedDocument | null> {
  const result = await showOpenDialog({
    title: '打开文件',
    properties: ['openFile'],
    filters: [
      // 默认「所有文件」，以便打开 .zshrc / .env 等无扩展名文件
      { name: '所有文件', extensions: ['*'] },
      { name: '图片', extensions: [...IMAGE_DIALOG_EXTENSIONS] },
      { name: '办公文档', extensions: [...OFFICE_DIALOG_EXTENSIONS] },
      { name: '文本文件', extensions: TEXT_DIALOG_EXTENSIONS },
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
    ],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return openDocumentAtPath(result.filePaths[0])
}

async function openFolderDialog(): Promise<string | null> {
  const result = await showOpenDialog({
    title: '打开文件夹',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
}

async function saveFileDialog(defaultPath?: string): Promise<string | null> {
  const result = await showSaveDialog({
    title: '保存文件',
    defaultPath: defaultPath ?? 'Untitled.md',
    filters: [
      { name: '所有文件', extensions: ['*'] },
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'Word 文档', extensions: ['docx'] },
      { name: 'Excel 表格', extensions: ['xlsx'] },
      { name: '文本文件', extensions: TEXT_DIALOG_EXTENSIONS },
    ],
  })
  if (result.canceled || !result.filePath) return null
  return result.filePath
}

type FileNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

async function readDirTree(dirPath: string, depth = 0): Promise<FileNode[]> {
  if (depth > 6) return []
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    // 点文件靠后，避免冲淡正文列表
    const aDot = a.name.startsWith('.') ? 1 : 0
    const bDot = b.name.startsWith('.') ? 1 : 0
    if (aDot !== bDot) return aDot - bDot
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  for (const entry of sorted) {
    if (SKIP_DIR_NAMES.has(entry.name) || SKIP_FILE_NAMES.has(entry.name)) continue
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      // 隐藏目录（除已列入跳过的）仍可展开，便于浏览 .config 等
      nodes.push({
        name: entry.name,
        path: full,
        type: 'directory',
        children: await readDirTree(full, depth + 1),
      })
    } else if (isTextPath(full) || isBinaryDocument(detectDocumentKind(full))) {
      nodes.push({ name: entry.name, path: full, type: 'file' })
    }
  }
  return nodes
}

function assertWithinRoot(root: string, target: string) {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(resolvedRoot + path.sep)
  ) {
    throw new Error('路径不在当前工作区内')
  }
}

function registerIpc() {
  ipcMain.handle('dialog:open-file', () => openFileDialog())
  ipcMain.handle('dialog:open-folder', () => openFolderDialog())
  ipcMain.handle('dialog:save-file', (_e, defaultPath?: string) => saveFileDialog(defaultPath))

  ipcMain.handle(
    'dialog:confirm',
    async (
      _e,
      options: { title?: string; message: string; detail?: string; dangerous?: boolean },
    ) => {
      if (!mainWindow) return false
      const result = await dialog.showMessageBox(mainWindow, {
        type: options.dangerous ? 'warning' : 'question',
        buttons: ['取消', options.dangerous ? '删除' : '确定'],
        defaultId: 0,
        cancelId: 0,
        title: options.title ?? APP_NAME,
        message: options.message,
        detail: options.detail,
      })
      return result.response === 1
    },
  )

  ipcMain.handle('fonts:cjk', async () => {
    if (cjkFontCache) return cjkFontCache
    const fontPath = resolveCjkFontPath()
    if (!fontPath) {
      throw new Error('未找到可用的中文字体，请安装 Arial Unicode / 微软雅黑 / 黑体')
    }
    cjkFontCache = await fs.readFile(fontPath)
    return cjkFontCache
  })

  ipcMain.handle('fs:read-file', async (_e, filePath: string) => {
    return readTextFile(filePath)
  })

  ipcMain.handle('fs:read-document', async (_e, filePath: string) => {
    return openDocumentAtPath(filePath)
  })

  ipcMain.handle('fs:write-file', async (_e, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('fs:write-buffer', async (_e, filePath: string, base64: string) => {
    await fs.writeFile(filePath, Buffer.from(base64, 'base64'))
    return true
  })

  ipcMain.handle('office:html-to-docx', async (_e, html: string, title: string) => {
    const mod = await import('html-to-docx')
    const HTMLtoDOCX = mod.default
    const safeTitle = String(title || 'document')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body>${html || '<p></p>'}</body></html>`
    const out = await HTMLtoDOCX(wrapped, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      header: false,
    })
    if (Buffer.isBuffer(out)) return out.toString('base64')
    if (out instanceof ArrayBuffer) return Buffer.from(out).toString('base64')
    const ab = await (out as Blob).arrayBuffer()
    return Buffer.from(ab).toString('base64')
  })

  ipcMain.handle('fs:exists', async (_e, targetPath: string) => {
    return existsSync(targetPath)
  })

  ipcMain.handle(
    'fs:mkdir',
    async (_e, dirPath: string, rootPath?: string) => {
      if (rootPath) assertWithinRoot(rootPath, dirPath)
      await fs.mkdir(dirPath, { recursive: false })
      return true
    },
  )

  ipcMain.handle(
    'fs:create-file',
    async (_e, filePath: string, content = '', rootPath?: string) => {
      if (rootPath) assertWithinRoot(rootPath, filePath)
      if (existsSync(filePath)) throw new Error('文件已存在')
      await fs.writeFile(filePath, content, { encoding: 'utf-8', flag: 'wx' })
      return true
    },
  )

  ipcMain.handle(
    'fs:rename',
    async (_e, fromPath: string, toPath: string, rootPath?: string) => {
      if (rootPath) {
        assertWithinRoot(rootPath, fromPath)
        assertWithinRoot(rootPath, toPath)
      }
      if (existsSync(toPath)) throw new Error('目标名称已存在')
      await fs.rename(fromPath, toPath)
      return true
    },
  )

  ipcMain.handle(
    'fs:delete',
    async (_e, targetPath: string, rootPath?: string) => {
      if (rootPath) assertWithinRoot(rootPath, targetPath)
      if (rootPath && path.resolve(targetPath) === path.resolve(rootPath)) {
        throw new Error('不能删除工作区根目录')
      }
      await fs.rm(targetPath, { recursive: true, force: false })
      return true
    },
  )

  ipcMain.handle('fs:read-dir-tree', async (_e, dirPath: string) => {
    return {
      root: dirPath,
      name: path.basename(dirPath),
      children: await readDirTree(dirPath),
    }
  })

  ipcMain.handle('app:set-title', (_e, title: string) => {
    if (mainWindow) mainWindow.setTitle(title)
  })

  ipcMain.handle('shell:show-item', (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })
}

app.setName(APP_NAME)

// 必须在 ready 之前注册：冷启动拖放 / 双击打开会先触发此事件
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  queueOpenFiles(filePath)
})

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    queueOpenFiles(collectArgvFiles(argv))
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    if (process.platform === 'darwin' && typeof app.setAboutPanelOptions === 'function') {
      app.setAboutPanelOptions({
        applicationName: APP_NAME,
        applicationVersion: app.getVersion(),
        copyright: 'Copyright © Lumen',
      })
    }

    registerIpc()
    createWindow()
    queueOpenFiles(collectArgvFiles())

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windowReadyToReceive = false
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
