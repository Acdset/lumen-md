import { useMemo } from 'react'
import type { ExcelSheetData } from '@/store/appStore'

type Props = {
  sheets: ExcelSheetData[]
  activeSheet: number
  onSheetsChange: (sheets: ExcelSheetData[], active?: number) => void
  onActiveSheet: (index: number) => void
}

export function ExcelEditor({ sheets, activeSheet, onSheetsChange, onActiveSheet }: Props) {
  const sheet = sheets[activeSheet] ?? sheets[0]

  const colLabels = useMemo(() => {
    if (!sheet) return []
    const n = sheet.rows[0]?.length ?? 0
    return Array.from({ length: n }, (_, i) => colName(i))
  }, [sheet])

  if (!sheet) {
    return <div className="office-pane excel-empty">表格为空</div>
  }

  const updateCell = (r: number, c: number, value: string) => {
    const next = sheets.map((s, si) => {
      if (si !== activeSheet) return s
      const rows = s.rows.map((row, ri) => {
        if (ri !== r) return row
        const cells = [...row]
        cells[c] = value
        return cells
      })
      return { ...s, rows }
    })
    onSheetsChange(next)
  }

  return (
    <div className="office-pane excel-pane">
      <div className="excel-tabs">
        {sheets.map((s, i) => (
          <button
            key={`${s.name}-${i}`}
            type="button"
            className={`excel-tab ${i === activeSheet ? 'active' : ''}`}
            onClick={() => onActiveSheet(i)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="excel-scroll">
        <table className="excel-table">
          <thead>
            <tr>
              <th className="excel-corner" />
              {colLabels.map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri}>
                <th>{ri + 1}</th>
                {row.map((cell, ci) => (
                  <td key={ci}>
                    <input
                      className="excel-cell"
                      value={cell}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function colName(index: number) {
  let n = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

export function excelToolbarActions(
  sheets: ExcelSheetData[],
  activeSheet: number,
  onSheetsChange: (sheets: ExcelSheetData[], active?: number) => void,
) {
  const mutate = (fn: (sheet: ExcelSheetData) => ExcelSheetData) => {
    const next = sheets.map((s, i) => (i === activeSheet ? fn(s) : s))
    onSheetsChange(next)
  }

  return {
    addRow: () =>
      mutate((s) => {
        const cols = s.rows[0]?.length || 8
        return { ...s, rows: [...s.rows, Array(cols).fill('')] }
      }),
    addCol: () =>
      mutate((s) => ({
        ...s,
        rows: s.rows.map((r) => [...r, '']),
      })),
    removeRow: () =>
      mutate((s) => ({
        ...s,
        rows: s.rows.length > 1 ? s.rows.slice(0, -1) : s.rows,
      })),
    removeCol: () =>
      mutate((s) => {
        if ((s.rows[0]?.length || 0) <= 1) return s
        return { ...s, rows: s.rows.map((r) => r.slice(0, -1)) }
      }),
  }
}
