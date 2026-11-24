import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
  hr: '---',
})

turndown.use(gfm)

turndown.addRule('keepBreak', {
  filter: 'br',
  replacement: () => '  \n',
})

turndown.addRule('taskListItem', {
  filter(node) {
    return (
      node.nodeName === 'LI' &&
      (node as HTMLElement).classList.contains('task-list-item')
    )
  },
  replacement(content, node) {
    const input = (node as HTMLElement).querySelector('input[type="checkbox"]') as HTMLInputElement | null
    const checked = input?.checked ? 'x' : ' '
    const text = content.replace(/^\s+/, '').replace(/\n+/g, '\n')
    return `- [${checked}] ${text}\n`
  },
})

turndown.addRule('mathBlock', {
  filter(node) {
    return node.nodeName === 'DIV' && (node as HTMLElement).classList.contains('math-block')
  },
  replacement(_content, node) {
    const tex = (node as HTMLElement).getAttribute('data-tex') || (node as HTMLElement).textContent || ''
    return `\n\`\`\`math\n${tex.trim()}\n\`\`\`\n\n`
  },
})

export function htmlToMarkdown(html: string): string {
  const cleaned = html
    .replace(/<div><br><\/div>/gi, '<p><br></p>')
    .replace(/&nbsp;/g, ' ')
  const md = turndown.turndown(cleaned)
  return md.replace(/\n{3,}/g, '\n\n').trimEnd() + (md.endsWith('\n') ? '' : '')
}
