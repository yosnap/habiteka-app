/** Spanish decimal commas and decimal points are accepted uniformly in editor inputs. */
export function parseEditorDecimal(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  return normalized ? Number(normalized) : Number.NaN;
}

export function formatEditorDecimal(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
