import { contextBridge, ipcRenderer, webUtils } from 'electron'

export type FileNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export type DirTree = {
  root: string
  name: string
  children: FileNode[]
}

const api = {
  openFile: () =>
    ipcRenderer.invoke('dialog:open-file') as Promise<{ path: string; content: string } | null>,
  openFolder: () => ipcRenderer.invoke('dialog:open-folder') as Promise<string | null>,
  saveFileDialog: (defaultPath?: string) =>
    ipcRenderer.invoke('dialog:save-file', defaultPath) as Promise<string | null>,
  confirm: (options: {
    title?: string
    message: string
    detail?: string
    dangerous?: boolean
  }) => ipcRenderer.invoke('dialog:confirm', options) as Promise<boolean>,
  readFile: (filePath: string) =>
    ipcRenderer.invoke('fs:read-file', filePath) as Promise<string>,
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:write-file', filePath, content) as Promise<boolean>,
  exists: (targetPath: string) =>
    ipcRenderer.invoke('fs:exists', targetPath) as Promise<boolean>,
  mkdir: (dirPath: string, rootPath?: string) =>
    ipcRenderer.invoke('fs:mkdir', dirPath, rootPath) as Promise<boolean>,
  createFile: (filePath: string, content?: string, rootPath?: string) =>
    ipcRenderer.invoke('fs:create-file', filePath, content ?? '', rootPath) as Promise<boolean>,
  renamePath: (fromPath: string, toPath: string, rootPath?: string) =>
    ipcRenderer.invoke('fs:rename', fromPath, toPath, rootPath) as Promise<boolean>,
  deletePath: (targetPath: string, rootPath?: string) =>
    ipcRenderer.invoke('fs:delete', targetPath, rootPath) as Promise<boolean>,
  readDirTree: (dirPath: string) =>
    ipcRenderer.invoke('fs:read-dir-tree', dirPath) as Promise<DirTree>,
  setTitle: (title: string) => ipcRenderer.invoke('app:set-title', title),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:show-item', filePath),
  /** 从拖放到窗口的 File 对象解析本地路径（Electron 32+） */
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return (file as File & { path?: string }).path || ''
    }
  },
  onMenu: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('lumen', api)

export type LumenAPI = typeof api
