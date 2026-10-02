import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('@/server/db/prisma', () => ({ prisma: { organization: { findUniqueOrThrow: db.read, updateMany: db.write } } }));
import { listRenderPresets, mutateRenderPreset } from '@/server/editor/render-preset-repo';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { OrgContext } from '@/server/auth/org-context';

const ctx: OrgContext = { organizationId: 'org-a', userId: 'user', role: 'member' };
const preset = { name: 'Casa cálida', style: 'moderno', objective: 'Vivienda familiar', instruction: 'Sin plantas',
  intent: 'image', spaceKind: 'casa', options: { ...defaultRenderDesignOptions(), designScope: 'house', redesignFixed: true } };
beforeEach(() => { vi.clearAllMocks(); db.read.mockResolvedValue({ metadata: '{"existing":"keep"}' }); db.write.mockResolvedValue({ count: 1 }); });

describe('plantillas por organización', () => {
  it('guarda en la organización autenticada y conserva otros metadatos', async () => {
    const result = await mutateRenderPreset(ctx, { ...preset, organizationId: 'org-other' });
    expect(result[0]).toMatchObject({ spaceKind: 'casa', instruction: 'Sin plantas' });
    expect(db.read.mock.calls[0]![0].where).toEqual({ id: 'org-a' });
    expect(db.write.mock.calls[0]![0].where).toEqual({ id: 'org-a', metadata: '{"existing":"keep"}' });
    const saved = JSON.parse(db.write.mock.calls[0]![0].data.metadata);
    expect(saved.existing).toBe('keep');
    expect(saved.habitekaRenderPresets[0].options.designScope).toBe('house');
    expect(saved.habitekaRenderPresets[0].organizationId).toBeUndefined();
  });
  it('relee tras una escritura concurrente para no perder otra plantilla', async () => {
    db.write.mockResolvedValueOnce({ count: 0 });
    db.read.mockResolvedValueOnce({ metadata: null }).mockResolvedValueOnce({ metadata: JSON.stringify({
      habitekaRenderPresets: [{ ...preset, name: 'Otra' }] }) });
    const result = await mutateRenderPreset(ctx, preset);
    expect(result.map((item) => item.name)).toEqual(['Casa cálida', 'Otra']);
    expect(db.write).toHaveBeenCalledTimes(2);
  });
  it('lista y elimina solo la plantilla nombrada', async () => {
    db.read.mockResolvedValue({ metadata: JSON.stringify({ existing: true,
      habitekaRenderPresets: [preset, { ...preset, name: 'Otra' }] }) });
    expect(await listRenderPresets(ctx)).toHaveLength(2);
    const remaining = await mutateRenderPreset(ctx, 'Casa cálida', true);
    expect(remaining.map((item) => item.name)).toEqual(['Otra']);
  });
  it('no borra metadatos corruptos ni insiste indefinidamente ante conflictos', async () => {
    db.read.mockResolvedValueOnce({ metadata: '{' });
    await expect(mutateRenderPreset(ctx, preset)).rejects.toThrow('metadatos');
    expect(db.write).not.toHaveBeenCalled();
    db.write.mockResolvedValue({ count: 0 });
    await expect(mutateRenderPreset(ctx, preset)).rejects.toThrow('Otra persona');
    expect(db.write).toHaveBeenCalledTimes(3);
  });
});
