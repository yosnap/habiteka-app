import { surfaceMaterial } from './surface-materials';
import type { Boundary } from './boundary-types';
import { isBoundaryKind } from './boundary-types';
import { OUTDOOR_CATALOG } from './outdoor-catalog';
const fail = (message: string): never => { throw new Error(message); };
function fields(value: unknown, allowed: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Cerramiento inválido');
  if (Object.keys(value as object).some((key) => !allowed.split(' ').includes(key))) fail('Campo de cerramiento desconocido');
}
const number = (value: unknown, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('Dimensión de cerramiento fuera de rango');
};
const color = (value: unknown) => { if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) fail('Color de cerramiento inválido'); };
export function assertBoundaryFields(value: Record<string, unknown>, ids: Set<string>) {
  if (value.boundaries === undefined) return;
  if (!Array.isArray(value.boundaries) || value.boundaries.length > 2000) fail('Colección de cerramientos inválida');
  const unique = (id: unknown) => { if (typeof id !== 'string' || !id.trim() || ids.has(id)) fail('ID de cerramiento duplicado o inválido'); ids.add(id as string); };
  for (const raw of value.boundaries as unknown[]) {
    fields(raw, 'id name kind catalogId x y widthMm depthMm rotation dimensionalOrigin heightMm elevationMm color construction');
    const b = raw as unknown as Boundary;
    unique(b.id);
    if (!isBoundaryKind(b.kind) || !OUTDOOR_CATALOG.some((entry) => entry.kind === b.kind && entry.id === b.catalogId)) fail('Tipo de cerramiento inválido');
    if (b.name !== undefined && (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 100)) fail('Nombre de cerramiento inválido');
    if (!['physical', 'raster'].includes(b.dimensionalOrigin)) fail('Procedencia de cerramiento inválida');
    number(b.x, -1e8, 1e8); number(b.y, -1e8, 1e8); number(b.rotation, -1e6, 1e6);
    number(b.widthMm, 50, 100000); number(b.depthMm, 20, 5000); number(b.heightMm, 50, 10000); number(b.elevationMm, 0, 100000); color(b.color);
    fields(b.construction, 'baseHeightMm baseColor baseMaterialId infillMaterialId postMaterialId infill slatWidthMm gapMm postShape postSizeMm postSpacingMm postColor gates');
    const c = b.construction;
    for (const material of [c.baseMaterialId, c.infillMaterialId, c.postMaterialId]) if (material !== undefined && (typeof material !== 'string' || !surfaceMaterial(material))) fail('Material de cerramiento desconocido');
    number(c.baseHeightMm, 0, b.heightMm); color(c.baseColor); color(c.postColor);
    if (!['vertical', 'horizontal', 'hedge'].includes(c.infill) || !['rectangle', 'circle'].includes(c.postShape)) fail('Composición de cerramiento inválida');
    number(c.slatWidthMm, 20, 1000); number(c.gapMm, 0, 1000);
    number(c.postSizeMm, 20, Math.min(b.depthMm, b.widthMm)); number(c.postSpacingMm, Math.max(200, c.postSizeMm * 2), 10000);
    if (!Array.isArray(c.gates) || c.gates.length > 50) fail('Puertas de cerramiento inválidas');
    let end = -Infinity;
    for (const gate of [...c.gates].sort((a, b) => a.positionMm - b.positionMm)) {
      fields(gate, 'id positionMm widthMm heightMm hinge openAngleDeg color'); unique(gate.id);
      number(gate.widthMm, 400, 6000); number(gate.heightMm, 400, b.heightMm); number(gate.positionMm, 0, b.widthMm);
      number(gate.openAngleDeg, -110, 110); color(gate.color);
      if (!['left', 'right'].includes(gate.hinge)) fail('Bisagra inválida');
      const start = gate.positionMm - gate.widthMm / 2, right = gate.positionMm + gate.widthMm / 2;
      if (start < c.postSizeMm || right > b.widthMm - c.postSizeMm) fail('La puerta debe quedar entre los postes extremos');
      if (start < end + c.postSizeMm) fail('Las puertas se solapan o no dejan espacio para el poste');
      end = right;
    }
  }
}
