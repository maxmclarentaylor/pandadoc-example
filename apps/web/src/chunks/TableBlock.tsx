import type { ChunkChange, TableChunk } from './types'

type TableBlockProps = {
  chunk: TableChunk
  onChange: ChunkChange
}

export default function TableBlock({ chunk, onChange }: TableBlockProps) {
  function updateColumn(index: number, value: string) {
    const columns = chunk.columns.map((column, columnIndex) => (columnIndex === index ? value : column))
    onChange({ ...chunk, columns })
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    const rows = chunk.rows.map((row, currentRow) =>
      currentRow === rowIndex
        ? row.map((cell, currentColumn) => (currentColumn === columnIndex ? value : cell))
        : row,
    )
    onChange({ ...chunk, rows })
  }

  return (
    <table className="chunk-table">
      <thead>
        <tr>
          {chunk.columns.map((column, index) => (
            <th key={index}>
              <input
                value={column}
                aria-label={`Column ${index + 1}`}
                onChange={(event) => updateColumn(index, event.target.value)}
              />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chunk.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, columnIndex) => (
              <td key={columnIndex}>
                <input
                  value={cell}
                  aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                  onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
