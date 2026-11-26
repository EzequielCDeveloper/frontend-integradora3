function escapeCsvCell(value: unknown): string {
  const raw = value == null ? '' : String(value)
  // Mitigate CSV formula injection (=, +, -, @) when opened in spreadsheets
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`
  }
  return neutralized
}

export function buildCsvContent(
  headers: string[],
  rows: Array<Array<unknown>>,
): string {
  const headerLine = headers.map(escapeCsvCell).join(',')
  const bodyLines = rows.map((row) => row.map(escapeCsvCell).join(','))
  return [headerLine, ...bodyLines].join('\r\n')
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: Array<Array<unknown>>,
): void {
  const csv = buildCsvContent(headers, rows)
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
