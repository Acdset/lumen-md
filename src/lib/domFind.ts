export type DomFindMatch = { from: number; to: number }

type Piece = { node: Text; start: number; end: number }

export function indexEditableText(root: HTMLElement) {
  const pieces: Piece[] = []
  let offset = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = node.textContent ?? ''
    pieces.push({ node: node as Text, start: offset, end: offset + text.length })
    offset += text.length
    node = walker.nextNode()
  }
  return {
    text: pieces.map((p) => p.node.textContent ?? '').join(''),
    pieces,
  }
}

export function findAllInText(text: string, query: string, caseSensitive: boolean): DomFindMatch[] {
  if (!query) return []
  const hay = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const matches: DomFindMatch[] = []
  let from = 0
  while (from <= hay.length - needle.length) {
    const idx = hay.indexOf(needle, from)
    if (idx < 0) break
    matches.push({ from: idx, to: idx + needle.length })
    from = idx + Math.max(1, needle.length)
  }
  return matches
}

function pointAt(pieces: Piece[], offset: number): { node: Text; offset: number } | null {
  for (const piece of pieces) {
    if (offset >= piece.start && offset <= piece.end) {
      return { node: piece.node, offset: offset - piece.start }
    }
  }
  const last = pieces[pieces.length - 1]
  if (!last) return null
  return { node: last.node, offset: last.node.textContent?.length ?? 0 }
}

export function selectDomMatch(root: HTMLElement, match: DomFindMatch) {
  const { pieces } = indexEditableText(root)
  const start = pointAt(pieces, match.from)
  const end = pointAt(pieces, match.to)
  if (!start || !end) return false
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  const el =
    range.startContainer instanceof HTMLElement
      ? range.startContainer
      : range.startContainer.parentElement
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return true
}

export function replaceDomMatch(root: HTMLElement, match: DomFindMatch, replacement: string) {
  const { pieces } = indexEditableText(root)
  const start = pointAt(pieces, match.from)
  const end = pointAt(pieces, match.to)
  if (!start || !end) return false
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  range.deleteContents()
  const textNode = document.createTextNode(replacement)
  range.insertNode(textNode)
  const sel = window.getSelection()
  const after = document.createRange()
  after.setStart(textNode, textNode.length)
  after.collapse(true)
  sel?.removeAllRanges()
  sel?.addRange(after)
  return true
}
