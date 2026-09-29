import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { selectSavedEditorDocument } from '@/server/agent/editor-v2/verified-editor-document';

describe('documento confirmado para diseño con IA', () => {
  it('usa la revisión del historial aunque el editor tenga otro número local', () => {
    const saved = { ...emptyEditorDocument(), revision: 124 };
    const local = { ...structuredClone(saved), revision: 125 };
    expect(selectSavedEditorDocument(local, saved)).toBe(saved);
  });

  it('rechaza un cambio de contenido posterior a la sincronización', () => {
    const saved = { ...emptyEditorDocument(), revision: 124 };
    const local = { ...structuredClone(saved), revision: 125,
      labels: [{ id: 'salon', text: 'Salón', x: 0, y: 0 }] };
    expect(() => selectSavedEditorDocument(local, saved)).toThrow(/Guarda y prepara otra vez/);
  });
});
