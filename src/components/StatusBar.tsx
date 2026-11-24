type Props = {
  words: number
  chars: number
  lines: number
  modeLabel: string
  themeLabel: string
}

export function StatusBar({ words, chars, lines, modeLabel, themeLabel }: Props) {
  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span>{modeLabel}</span>
        <span>{themeLabel}</span>
      </div>
      <div className="statusbar-right">
        <span>{words} 词</span>
        <span>{chars} 字</span>
        <span>{lines} 行</span>
      </div>
    </footer>
  )
}
