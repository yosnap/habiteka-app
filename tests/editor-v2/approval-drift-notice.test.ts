/**
 * Mover un mueble 1 cm con las flechas aparta el plano del diseño aprobado; el editor debe avisarlo en el momento.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { sameVisualDesignContent } from '@/lib/editor-document/visual-design-content';
import { ApprovalDriftNotice } from '@/components/editor-v2/session/approval-drift-notice';

const approved = { ...emptyEditorDocument(), furniture: [{ id: 'fuente', kind: 'fuente', x: 9750, y: 5970, widthMm: 1159, depthMm: 950,
  rotation: 0, dimensionalOrigin: 'physical' as const }] };

describe('aviso al apartarse del diseño aprobado', () => {
  it('un empujón de 1 cm cambia el diseño; una ruta o un comentario no', () => {
    const nudged = { ...approved, furniture: [{ ...approved.furniture[0]!, y: 5960 }] };
    expect(sameVisualDesignContent(nudged, approved)).toBe(false);
    expect(sameVisualDesignContent({ ...approved, revision: 9, comments: [] }, approved)).toBe(true);
  });

  it('ofrece deshacer solo si hay historial y aprobar solo si se puede guardar', () => {
    const markup = (props: Partial<Parameters<typeof ApprovalDriftNotice>[0]>) => renderToStaticMarkup(createElement(ApprovalDriftNotice,
      { onDismiss: () => undefined, disabled: false, ...props }));
    const full = markup({ onUndo: () => undefined, onApprove: () => undefined });
    expect(full).toContain('ya no coincide con el diseño aprobado');
    expect(full).toContain('Deshacer');
    expect(full).toContain('Aprobar cambios');
    const bare = markup({});
    expect(bare).not.toContain('Deshacer');
    expect(bare).not.toContain('Aprobar cambios');
    expect(bare).toContain('Mantener el cambio');
  });
});
