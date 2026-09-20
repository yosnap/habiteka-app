import { describe, expect, it } from 'vitest';
import { conceptRenderPrompt } from '@/server/agent/editor-v2/concept-render-prompt';
import { furnitureDesignContext } from '@/lib/editor-document/furniture-context';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

describe('conceptRenderPrompt', () => {
  it('reproduce el baseline de KIE sin envolver ni resumir el contexto', () => {
    const document = { ...emptyEditorDocument(), revision: 185 };

    expect(conceptRenderPrompt(document, 'moderno')).toBe([
      'Crea un diseño moderno para este exterior de una casa respetando las medidas, cotas, etc.',
      'Respeta las alturas de cada elemento: los muros, las paredes, las escaleras y rampa con sus descansos en sus posiciones originales. No agregues elementos a la construcción, como mucho un toldo o estructura para tapar del sol. Puedes agregar luces o farolas que ayuden a la iluminación en la noche así como elementos de construcción. Lo importante es que respetes íntegramente el espacio, medidas, alturas, cotas, etc.',
      'Te paso la información del proyecto en json:',
      JSON.stringify(furnitureDesignContext(document), null, 2),
    ].join('\n\n'));
  });
});
