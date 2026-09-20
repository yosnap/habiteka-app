import { createHash } from 'node:crypto';
import { parseEditorDocument } from '@/lib/editor-document/validation';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      throw new Error('El documento debe contener objetos JSON simples');
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return value;
  throw new Error('El documento debe contener datos JSON válidos');
}
export function documentFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
export function readDocumentInput(value: unknown) {
  if (value && typeof value === 'object') {
    let total = 0;
    for (const key of ['vertices', 'walls', 'openings', 'furniture', 'dimensions', 'labels', 'stairs', 'comments']) {
      const collection = (value as Record<string, unknown>)[key];
      if (!Array.isArray(collection)) continue;
      if (collection.length > (key === 'walls' ? 1000 : 2000))
        throw new Error('Documento supera el límite de elementos soportado');
      total += collection.length;
    }
    if (total > 6000) throw new Error('Documento supera el límite de elementos soportado');
  }
  const json = JSON.stringify(value);
  if (!json || Buffer.byteLength(json, 'utf8') > 2_000_000)
    throw new Error('Documento demasiado grande o inválido');
  canonical(value); // Reject values that JSON serialization would silently remove.
  return parseEditorDocument(value);
}
export function assertRevision(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 2_147_483_647)
    throw new Error('Revisión inválida');
}
