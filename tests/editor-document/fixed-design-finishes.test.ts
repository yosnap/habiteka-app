import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addKitchenRun } from '@/lib/editor-document/kitchen-run-commands';
import { applyFixedFinishes, validateFixedFinishes } from '@/lib/editor-document/fixed-design-finishes';
import { designScopeRooms } from '@/lib/editor-document/design-scope';
import { renderScopeRegions } from '@/lib/editor-document/render-scope-regions';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';

function fixture() {
  const source = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 },
    { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
  return addKitchenRun(source, { x: 500, y: 500 }, { x: 2500, y: 500 });
}
describe('rediseño explícito de fijos', () => {
  it('exige permiso y una identidad dentro del ámbito elegido', () => {
    const doc = fixture(), id = doc.kitchenRuns![0]!.id, scope = { kind: 'all' as const, roomIds: [] };
    const changes = [{ id, color: '#445566' }, { id: 'inventado', color: '#ffffff' }];
    expect(validateFixedFinishes(changes, doc, scope, false)).toEqual([]);
    expect(validateFixedFinishes(changes, doc, scope, true)).toMatchObject([{ id, color: '#445566' }]);
    expect(validateFixedFinishes([{ id, color: 'rojo' }], doc, scope, true)).toEqual([]);
  });
  it('aplica color y material de cocina sin cambiar construcción, módulos ni medidas', () => {
    const doc = fixture(), before = structuredClone(doc.kitchenRuns![0]!);
    applyFixedFinishes(doc, { kind: 'all', roomIds: [] }, [{ id: before.id, color: '#445566', worktopMaterialId: 'polyhaven:wood_floor' }]);
    expect(doc.kitchenRuns![0]).toEqual({ ...before, color: '#445566', kitchen: { ...before.kitchen, worktopMaterialId: 'polyhaven:wood_floor' } });
  });
  it('Solo la casa selecciona estancias interiores y prepara su máscara', () => {
    const doc = fixture();
    expect(designScopeRooms(doc, { kind: 'house', roomIds: [] })).toHaveLength(1);
    expect(renderScopeRegions(doc, { ...defaultRenderDesignOptions(), designScope: 'house' })).toHaveLength(1);
    expect(() => renderScopeRegions(emptyEditorDocument(), { ...defaultRenderDesignOptions(), designScope: 'house' })).toThrow('No hay estancias');
  });
});
