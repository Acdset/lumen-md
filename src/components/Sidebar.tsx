import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { ChevronRight, FileText, Folder, FolderOpen, Search, X } from 'lucide-react'
import type { FileNode } from '@/store/appStore'
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu'

function filterTree(nodes: FileNode[], query: string): FileNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const result: FileNode[] = []
  for (const node of nodes) {
    if (node.type === 'directory') {
      const children = filterTree(node.children ?? [], q)
      const selfMatch = node.name.toLowerCase().includes(q)
      if (children.length || selfMatch) {
        result.push({
          ...node,
          // 文件夹名命中时展示全部子项；否则只保留命中分支
          children: selfMatch ? node.children : children,
        })
      }
    } else if (node.name.toLowerCase().includes(q)) {
      result.push(node)
    }
  }
  return result
}

type Props = {
  folderName: string | null
  folderPath: string | null
  tree: FileNode[]
  activePath: string | null
  onOpenFile: (path: string) => void
  onOpenFolder: () => void
  onRefreshTree: () => Promise<void> | void
  onFileDeleted: (path: string) => void
  onFileRenamed: (fromPath: string, toPath: string) => void
  onFileCreated: (path: string) => void
}

type MenuTarget =
  | { kind: 'file'; node: FileNode }
  | { kind: 'directory'; node: FileNode }
  | { kind: 'blank' }

type MenuState = {
  x: number
  y: number
  target: MenuTarget
}

function parentDir(filePath: string) {
  const i = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return i >= 0 ? filePath.slice(0, i) : filePath
}

function joinPath(dir: string, name: string) {
  if (!dir) return name
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/'
  return dir.endsWith('/') || dir.endsWith('\\') ? `${dir}${name}` : `${dir}${sep}${name}`
}

function splitName(name: string) {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { stem: name, ext: '' }
  return { stem: name.slice(0, dot), ext: name.slice(dot) }
}

async function uniqueName(dir: string, baseName: string) {
  let candidate = baseName
  let index = 2
  const { stem, ext } = splitName(baseName)
  while (await window.lumen.exists(joinPath(dir, candidate))) {
    candidate = `${stem} ${index}${ext}`
    index += 1
  }
  return candidate
}

function isValidName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (trimmed === '.' || trimmed === '..') return false
  if (/[\\/:\0]/.test(trimmed)) return false
  return true
}

function TreeItem({
  node,
  depth,
  activePath,
  renamingPath,
  onOpenFile,
  onContextMenu,
  onRenameCommit,
  onRenameCancel,
  forceOpenPath,
  expandAll,
}: {
  node: FileNode
  depth: number
  activePath: string | null
  renamingPath: string | null
  onOpenFile: (path: string) => void
  onContextMenu: (e: ReactMouseEvent, target: MenuTarget) => void
  onRenameCommit: (path: string, nextName: string) => void
  onRenameCancel: () => void
  forceOpenPath: string | null
  expandAll: boolean
}) {
  const [open, setOpen] = useState(depth < 1 || expandAll)
  const inputRef = useRef<HTMLInputElement>(null)
  const renaming = renamingPath === node.path

  useEffect(() => {
    if (expandAll) setOpen(true)
  }, [expandAll])

  useEffect(() => {
    if (forceOpenPath && (forceOpenPath === node.path || forceOpenPath.startsWith(node.path + '/'))) {
      setOpen(true)
    }
  }, [forceOpenPath, node.path])

  useEffect(() => {
    if (!renaming || !inputRef.current) return
    inputRef.current.focus()
    const value = inputRef.current.value
    if (node.type === 'file') {
      const { stem } = splitName(value)
      inputRef.current.setSelectionRange(0, stem.length)
    } else {
      inputRef.current.select()
    }
  }, [renaming, node.type])

  const renameField = renaming ? (
    <input
      ref={inputRef}
      className="tree-rename-input"
      defaultValue={node.name}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          onRenameCommit(node.path, (e.target as HTMLInputElement).value)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onRenameCancel()
        }
      }}
      onBlur={(e) => onRenameCommit(node.path, e.target.value)}
    />
  ) : (
    <span>{node.name}</span>
  )

  if (node.type === 'directory') {
    return (
      <div className="tree-dir">
        <button
          type="button"
          className={`tree-row ${renaming ? 'renaming' : ''}`}
          style={{ paddingLeft: 10 + depth * 14 }}
          onClick={() => {
            if (!renaming) setOpen((v) => !v)
          }}
          onContextMenu={(e) => onContextMenu(e, { kind: 'directory', node })}
        >
          <ChevronRight size={14} className={`chevron ${open ? 'open' : ''}`} />
          {open ? <FolderOpen size={15} /> : <Folder size={15} />}
          {renameField}
        </button>
        {open &&
          node.children?.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              renamingPath={renamingPath}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              forceOpenPath={forceOpenPath}
              expandAll={expandAll}
            />
          ))}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`tree-row file ${activePath === node.path ? 'active' : ''} ${renaming ? 'renaming' : ''}`}
      style={{ paddingLeft: 28 + depth * 14 }}
      onClick={() => {
        if (!renaming) onOpenFile(node.path)
      }}
      onContextMenu={(e) => onContextMenu(e, { kind: 'file', node })}
      onDoubleClick={() => onOpenFile(node.path)}
    >
      <FileText size={15} />
      {renameField}
    </button>
  )
}

export function Sidebar({
  folderName,
  folderPath,
  tree,
  activePath,
  onOpenFile,
  onOpenFolder,
  onRefreshTree,
  onFileDeleted,
  onFileRenamed,
  onFileCreated,
}: Props) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [forceOpenPath, setForceOpenPath] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const busy = useRef(false)
  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query])
  const searching = query.trim().length > 0

  const closeMenu = useCallback(() => setMenu(null), [])

  const openMenu = useCallback((e: ReactMouseEvent, target: MenuTarget) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, target })
  }, [])

  const menuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menu) return []
    if (menu.target.kind === 'blank') {
      return [
        { id: 'new-file', label: '新建文件' },
        { id: 'new-folder', label: '新建文件夹' },
        { type: 'separator' },
        { id: 'refresh', label: '刷新' },
      ]
    }
    if (menu.target.kind === 'directory') {
      return [
        { id: 'new-file', label: '新建文件' },
        { id: 'new-folder', label: '新建文件夹' },
        { type: 'separator' },
        { id: 'reveal', label: '在访达中显示' },
        { id: 'copy-path', label: '复制路径' },
        { type: 'separator' },
        { id: 'rename', label: '重命名' },
        { id: 'delete', label: '删除', danger: true },
      ]
    }
    return [
      { id: 'open', label: '打开' },
      { type: 'separator' },
      { id: 'reveal', label: '在访达中显示' },
      { id: 'copy-path', label: '复制路径' },
      { type: 'separator' },
      { id: 'rename', label: '重命名' },
      { id: 'delete', label: '删除', danger: true },
    ]
  }, [menu])

  const resolveCreateDir = useCallback(
    (target: MenuTarget) => {
      if (!folderPath) return null
      if (target.kind === 'directory') return target.node.path
      if (target.kind === 'file') return parentDir(target.node.path)
      return folderPath
    },
    [folderPath],
  )

  const createItem = useCallback(
    async (target: MenuTarget, kind: 'file' | 'directory') => {
      if (!folderPath || busy.current) return
      const dir = resolveCreateDir(target)
      if (!dir) return
      busy.current = true
      try {
        const baseName = kind === 'file' ? '未命名.md' : '新建文件夹'
        const name = await uniqueName(dir, baseName)
        const fullPath = joinPath(dir, name)
        if (kind === 'file') {
          await window.lumen.createFile(fullPath, '', folderPath)
        } else {
          await window.lumen.mkdir(fullPath, folderPath)
        }
        setForceOpenPath(dir)
        await onRefreshTree()
        setRenamingPath(fullPath)
        if (kind === 'file') onFileCreated(fullPath)
      } catch (err) {
        console.error('[Lumen] create item failed', err)
        window.alert(err instanceof Error ? err.message : '创建失败')
      } finally {
        busy.current = false
      }
    },
    [folderPath, onFileCreated, onRefreshTree, resolveCreateDir],
  )

  const renameCommit = useCallback(
    async (fromPath: string, nextName: string) => {
      if (!folderPath) {
        setRenamingPath(null)
        return
      }
      const name = nextName.trim()
      if (!isValidName(name)) {
        setRenamingPath(null)
        return
      }
      const toPath = joinPath(parentDir(fromPath), name)
      if (toPath === fromPath) {
        setRenamingPath(null)
        return
      }
      if (busy.current) return
      busy.current = true
      try {
        await window.lumen.renamePath(fromPath, toPath, folderPath)
        setRenamingPath(null)
        await onRefreshTree()
        onFileRenamed(fromPath, toPath)
      } catch (err) {
        console.error('[Lumen] rename failed', err)
        window.alert(err instanceof Error ? err.message : '重命名失败')
        setRenamingPath(null)
      } finally {
        busy.current = false
      }
    },
    [folderPath, onFileRenamed, onRefreshTree],
  )

  const deleteTarget = useCallback(
    async (target: Extract<MenuTarget, { kind: 'file' | 'directory' }>) => {
      if (!folderPath || busy.current) return
      const isDir = target.kind === 'directory'
      const ok = await window.lumen.confirm({
        title: isDir ? '删除文件夹' : '删除文件',
        message: `确定删除“${target.node.name}”吗？`,
        detail: isDir ? '文件夹及其内容将被删除，此操作不可撤销。' : '此操作不可撤销。',
        dangerous: true,
      })
      if (!ok) return
      busy.current = true
      try {
        await window.lumen.deletePath(target.node.path, folderPath)
        await onRefreshTree()
        onFileDeleted(target.node.path)
      } catch (err) {
        console.error('[Lumen] delete failed', err)
        window.alert(err instanceof Error ? err.message : '删除失败')
      } finally {
        busy.current = false
      }
    },
    [folderPath, onFileDeleted, onRefreshTree],
  )

  const onMenuSelect = useCallback(
    async (id: string) => {
      if (!menu) return
      const { target } = menu
      switch (id) {
        case 'open':
          if (target.kind === 'file') onOpenFile(target.node.path)
          break
        case 'reveal':
          if (target.kind !== 'blank') void window.lumen.showItemInFolder(target.node.path)
          break
        case 'copy-path':
          if (target.kind !== 'blank') {
            try {
              await navigator.clipboard.writeText(target.node.path)
            } catch (err) {
              console.error('[Lumen] copy path failed', err)
            }
          }
          break
        case 'rename':
          if (target.kind !== 'blank') setRenamingPath(target.node.path)
          break
        case 'delete':
          if (target.kind === 'file' || target.kind === 'directory') {
            await deleteTarget(target)
          }
          break
        case 'new-file':
          await createItem(target, 'file')
          break
        case 'new-folder':
          await createItem(target, 'directory')
          break
        case 'refresh':
          await onRefreshTree()
          break
      }
    },
    [createItem, deleteTarget, menu, onOpenFile, onRefreshTree],
  )

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">{folderName ?? '文件'}</span>
        <button className="ghost-btn" onClick={onOpenFolder} title="打开文件夹">
          打开
        </button>
      </div>
      {folderName && (
        <div className="panel-search">
          <Search size={14} className="panel-search-icon" />
          <input
            className="panel-search-input"
            value={query}
            placeholder="搜索文件…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault()
                setQuery('')
              }
            }}
          />
          {searching && (
            <button
              type="button"
              className="panel-search-clear"
              title="清除"
              onClick={() => setQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <div
        className="sidebar-body"
        onContextMenu={(e) => {
          if (!folderPath) return
          // 空白处右键
          if ((e.target as HTMLElement).closest('.tree-row')) return
          openMenu(e, { kind: 'blank' })
        }}
      >
        {!folderName && (
          <div className="sidebar-empty">
            <p>打开一个文件夹，开始整理笔记</p>
            <button className="primary-btn" onClick={onOpenFolder}>
              打开文件夹
            </button>
          </div>
        )}
        {folderName && searching && filteredTree.length === 0 && (
          <p className="panel-search-empty">无匹配文件</p>
        )}
        {filteredTree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            activePath={activePath}
            renamingPath={renamingPath}
            onOpenFile={onOpenFile}
            onContextMenu={openMenu}
            onRenameCommit={(path, name) => void renameCommit(path, name)}
            onRenameCancel={() => setRenamingPath(null)}
            forceOpenPath={forceOpenPath}
            expandAll={searching}
          />
        ))}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onSelect={(id) => void onMenuSelect(id)}
          onClose={closeMenu}
        />
      )}
    </aside>
  )
}
