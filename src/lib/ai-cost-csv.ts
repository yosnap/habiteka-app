/** Protege también contra fórmulas al abrir el CSV en una hoja de cálculo. */
export function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${(/^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw).replaceAll('"', '""')}"`;
}
export function csvRow(values: unknown[]): string { return values.map(csvCell).join(',') + '\r\n'; }
