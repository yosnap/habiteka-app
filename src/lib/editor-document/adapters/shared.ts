import { emptyEditorDocument, type EditorDocument, type Point } from '../schema';
import { assertEditorDocument } from '../validation';

export interface ConversionResult {
  snapshot: unknown;
  document: EditorDocument | null;
  complete: boolean;
  issues: string[];
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objeto no válido');
  return value as Record<string, unknown>;
}
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Lista no válida');
  return value;
}
export function numeric(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Coordenada o medida no válida');
  return value;
}
export function string(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Identificador o texto no válido');
  return value;
}
export function point(value: unknown, factor = 1, issues?: string[], known = ['x', 'y']): Point {
  const p = record(value);
  if (issues) unknownFields(p, known, issues);
  return { x: numeric(p.x) * factor, y: numeric(p.y) * factor };
}
export function vertexId(doc: EditorDocument, p: Point): string {
  // Trig round-trips add sub-nanometre noise; never snap measurable geometry.
  const existing = doc.vertices.find((v) => Math.hypot(v.x - p.x, v.y - p.y) <= 1e-7);
  if (existing) return existing.id;
  const id = `vertex:${doc.vertices.length}`;
  doc.vertices.push({ id, ...p });
  return id;
}
export function unknownFields(raw: Record<string, unknown>, known: string[], issues: string[]): void {
  for (const key of Object.keys(raw)) if (!known.includes(key)) issues.push(`Campo no convertible: ${key}`);
}
export function convert(raw: unknown, build: (source: Record<string, unknown>, doc: EditorDocument, issues: string[]) => void): ConversionResult {
  // Nunca pasar por el normalizador legacy antes de conservar la entrada íntegra.
  const snapshot = structuredClone(raw);
  const issues: string[] = [];
  const document = emptyEditorDocument();
  try {
    build(record(raw), document, issues);
    assertEditorDocument(document);
    return { snapshot, document, issues, complete: issues.length === 0 };
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'No se pudo convertir el documento');
    return { snapshot, document: null, issues, complete: false };
  }
}
