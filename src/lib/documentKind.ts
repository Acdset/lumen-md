export type DocumentKind =
  | 'markdown'
  | 'text'
  | 'word'
  | 'excel'
  | 'pdf'
  | 'image'
  | 'unknown'

const MARKDOWN_EXT = /\.(md|markdown|mdown|mkd)$/i
const WORD_EXT = /\.(docx|doc)$/i
const EXCEL_EXT = /\.(xlsx|xls|xlsm|ods)$/i
const PDF_EXT = /\.pdf$/i
const IMAGE_EXT =
  /\.(png|jpe?g|gif|webp|bmp|ico|svg|avif|tiff?|heic|heif|jfif|pjpeg|pjp|apng)$/i
const TEXT_EXT =
  /\.(txt|text|json|jsonc|json5|yml|yaml|toml|ini|conf|cfg|config|env|properties|sh|bash|zsh|fish|ps1|py|rb|pl|php|js|jsx|mjs|cjs|ts|tsx|cts|mts|css|scss|less|sass|html|htm|xml|csv|tsv|log|rs|go|java|kt|kts|c|h|cpp|cc|cxx|hpp|hxx|cs|swift|m|mm|sql|graphql|gql|r|lua|vue|svelte|astro|mdx|tex|rst|adoc|gitignore|dockerignore|editorconfig|npmrc|yarnrc|nvmrc|prettierrc|eslintrc|babelrc|lock|plist|entitlements|strings|xcconfig|pbxproj|gradle|dart|ex|exs|erl|hrl|clj|cljs|edn|hs|elm|fs|fsx|fsi|ml|mli|nim|zig|tf|hcl|proto|diff|patch|org|wiki)$/i

export function basenameOf(pathOrName: string) {
  const parts = pathOrName.split(/[/\\]/)
  return parts[parts.length - 1] || pathOrName
}

export function detectDocumentKind(pathOrName: string | null | undefined): DocumentKind {
  if (!pathOrName) return 'markdown'
  const name = basenameOf(pathOrName)
  if (MARKDOWN_EXT.test(name)) return 'markdown'
  if (WORD_EXT.test(name)) return 'word'
  if (EXCEL_EXT.test(name)) return 'excel'
  if (PDF_EXT.test(name)) return 'pdf'
  if (IMAGE_EXT.test(name)) return 'image'
  if (TEXT_EXT.test(name)) return 'text'
  if (!name.includes('.')) return 'text'
  return 'unknown'
}

export function isMarkdownFile(pathOrName: string | null | undefined) {
  return detectDocumentKind(pathOrName) === 'markdown'
}

export function isOfficeOrMarkdown(kind: DocumentKind) {
  return (
    kind === 'markdown' ||
    kind === 'word' ||
    kind === 'excel' ||
    kind === 'pdf' ||
    kind === 'image'
  )
}

export function isBinaryDocument(kind: DocumentKind) {
  return kind === 'word' || kind === 'excel' || kind === 'pdf' || kind === 'image'
}

export function defaultModeForKind(kind: DocumentKind): 'wysiwyg' | 'live' | 'source' | 'office' {
  if (kind === 'markdown') return 'wysiwyg'
  if (isBinaryDocument(kind)) return 'office'
  return 'source'
}

export function mimeForImagePath(pathOrName: string) {
  const name = basenameOf(pathOrName).toLowerCase()
  if (name.endsWith('.png') || name.endsWith('.apng')) return 'image/png'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.bmp')) return 'image/bmp'
  if (name.endsWith('.ico')) return 'image/x-icon'
  if (name.endsWith('.svg')) return 'image/svg+xml'
  if (name.endsWith('.avif')) return 'image/avif'
  if (name.endsWith('.tif') || name.endsWith('.tiff')) return 'image/tiff'
  if (name.endsWith('.heic')) return 'image/heic'
  if (name.endsWith('.heif')) return 'image/heif'
  return 'image/jpeg'
}

export const IMAGE_EXTENSIONS = [
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
] as const

export const OFFICE_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'xlsm'] as const
