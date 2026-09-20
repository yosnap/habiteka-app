import { surfaceMaterial } from './surface-materials';
import { KITCHEN_RUN_CATALOG_ID, KITCHEN_RUN_KIND, KITCHEN_SLOT_KINDS, type KitchenRun } from './kitchen-run-types';
const fail = (message: string): never => { throw new Error(message); };
function fields(value: unknown, allowed: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Mueble de cocina inválido');
  if (Object.keys(value as object).some((key) => !allowed.split(' ').includes(key))) fail('Campo de mueble de cocina desconocido');
}
const number = (value: unknown, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('Dimensión de mueble de cocina fuera de rango');
};
const color = (value: unknown) => { if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) fail('Color de mueble de cocina inválido'); };
const material = (value: unknown) => { if (value !== undefined && (typeof value !== 'string' || !surfaceMaterial(value))) fail('Material de cocina desconocido'); };
export function assertKitchenRunFields(value: Record<string, unknown>, ids: Set<string>) {
  if (value.kitchenRuns === undefined) return;
  if (!Array.isArray(value.kitchenRuns) || value.kitchenRuns.length > 500) fail('Colección de muebles de cocina inválida');
  const unique = (id: unknown) => { if (typeof id !== 'string' || !id.trim() || ids.has(id)) fail('ID de mueble de cocina duplicado o inválido'); ids.add(id as string); };
  for (const raw of value.kitchenRuns as unknown[]) {
    fields(raw, 'id name kind catalogId x y widthMm depthMm rotation dimensionalOrigin heightMm elevationMm color kitchen');
    const run = raw as unknown as KitchenRun;
    unique(run.id);
    if (run.kind !== KITCHEN_RUN_KIND || run.catalogId !== KITCHEN_RUN_CATALOG_ID) fail('Tipo de mueble de cocina inválido');
    if (run.name !== undefined && (typeof run.name !== 'string' || !run.name.trim() || run.name.length > 100)) fail('Nombre de mueble de cocina inválido');
    if (!['physical', 'raster'].includes(run.dimensionalOrigin)) fail('Procedencia de mueble de cocina inválida');
    number(run.x, -1e8, 1e8); number(run.y, -1e8, 1e8); number(run.rotation, -1e6, 1e6);
    number(run.widthMm, 300, 30000); number(run.depthMm, 300, 1200); number(run.heightMm, 700, 1200); number(run.elevationMm, 0, 100000); color(run.color);
    fields(run.kitchen, 'plinthHeightMm plinthColor worktopThicknessMm worktopColor worktopMaterialId baseMaterialId moduleWidthMm uppers slots');
    const k = run.kitchen;
    number(k.plinthHeightMm, 0, 300); color(k.plinthColor); number(k.worktopThicknessMm, 10, 100); color(k.worktopColor);
    material(k.worktopMaterialId); material(k.baseMaterialId);
    if (k.plinthHeightMm + k.worktopThicknessMm > run.heightMm - 200) fail('El zócalo y la encimera no dejan sitio a los módulos bajos');
    number(k.moduleWidthMm, 300, 1200);
    if (k.uppers !== undefined) {
      fields(k.uppers, 'bottomMm heightMm depthMm color materialId');
      const u = k.uppers;
      number(u.bottomMm, run.heightMm + 100, 3000); number(u.heightMm, 200, 1500); number(u.depthMm, 200, run.depthMm); color(u.color); material(u.materialId);
      if (u.bottomMm + u.heightMm > 4000) fail('Los módulos altos superan la altura admisible');
    }
    if (!Array.isArray(k.slots) || k.slots.length > 50) fail('Huecos de cocina inválidos');
    let end = -Infinity;
    for (const slot of [...k.slots].sort((a, b) => a.positionMm - b.positionMm)) {
      fields(slot, 'id kind positionMm widthMm color'); unique(slot.id);
      if (!KITCHEN_SLOT_KINDS.includes(slot.kind)) fail('Aparato de cocina desconocido');
      number(slot.widthMm, 300, 1500); number(slot.positionMm, 0, run.widthMm); color(slot.color);
      const start = slot.positionMm - slot.widthMm / 2, right = slot.positionMm + slot.widthMm / 2;
      if (start < 0 || right > run.widthMm) fail('El aparato sobresale del mueble');
      if (start < end) fail('Los aparatos se solapan');
      end = right;
    }
  }
}
