import { describe, expect, it, vi } from 'vitest';
import { renderDrawingReferences } from '@/server/agent/editor-v2/render-drawing-references';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';

vi.mock('@/server/agent/editor-v2/rasterize-editor-elevation', () => ({
  rasterizeEditorElevation: vi.fn(() => { throw new Error('No se debe seccionar una fachada cerrada'); }),
  sectionRooms: vi.fn(),
}));

describe('referencias de fachada cerrada', () => {
  it.each(['front', 'back', 'left', 'right'] as const)('conserva el exterior terminado %s sin sustituirlo por una sección', async preset => {
    const view = { preset, cutaway: false, ceilingView: 'solid' } as RenderView;
    expect(await renderDrawingReferences(emptyEditorDocument(), view, defaultRenderDesignOptions(), true, false)).toEqual({});
  });
});
