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

/** 可在侧栏列出的扩展名（文本 + 办公 + 图片） */
export const LISTABLE_EXT =
  /\.(md|markdown|mdown|mkd|txt|text|json|jsonc|json5|yml|yaml|toml|ini|conf|cfg|config|env|properties|sh|bash|zsh|fish|ps1|py|rb|pl|php|js|jsx|mjs|cjs|ts|tsx|cts|mts|css|scss|less|sass|html|htm|xml|csv|tsv|log|rs|go|java|kt|kts|c|h|cpp|cc|cxx|hpp|hxx|cs|swift|m|mm|sql|graphql|gql|r|lua|vue|svelte|astro|mdx|tex|rst|adoc|gitignore|dockerignore|editorconfig|npmrc|yarnrc|nvmrc|prettierrc|eslintrc|babelrc|lock|plist|entitlements|strings|xcconfig|pbxproj|gradle|dart|ex|exs|erl|hrl|clj|cljs|edn|hs|elm|fs|fsx|fsi|ml|mli|nim|zig|tf|hcl|proto|diff|patch|org|wiki|pdf|docx|doc|xlsx|xls|xlsm|ods|png|jpe?g|gif|webp|bmp|ico|svg|avif|tiff?|heic|heif|jfif|apng)$/i

export function detectDocumentKind(filePath: string): DocumentKind {
  const name = filePath.split(/[/\\]/).pop() || filePath
  if (MARKDOWN_EXT.test(name)) return 'markdown'
  if (WORD_EXT.test(name)) return 'word'
  if (EXCEL_EXT.test(name)) return 'excel'
  if (PDF_EXT.test(name)) return 'pdf'
  if (IMAGE_EXT.test(name)) return 'image'
  if (LISTABLE_EXT.test(name)) return 'text'
  if (!name.includes('.')) return 'text'
  return 'unknown'
}

export function isBinaryDocument(kind: DocumentKind) {
  return kind === 'word' || kind === 'excel' || kind === 'pdf' || kind === 'image'
}
