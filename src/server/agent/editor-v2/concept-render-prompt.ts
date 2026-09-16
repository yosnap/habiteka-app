import type { Estilo } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import { furnitureDesignContext } from '@/lib/editor-document/furniture-context';
import type { EditorDocument } from '@/lib/editor-document/schema';

/**
 * Baseline validado en el Playground de KIE.
 *
 * No mezclar aquí contratos de render, resúmenes ni imágenes de referencia:
 * cada una de esas variables cambia el resultado y se evaluará por separado.
 */
export function conceptRenderPrompt(
  document: EditorDocument,
  estilo: Estilo,
  objetivo = '',
  instruccion = '',
): string {
  return [
    `Crea un diseño ${estiloLabel(estilo).toLocaleLowerCase('es-ES')} para este exterior de una casa respetando las medidas, cotas, etc.`,
    'Respeta las alturas de cada elemento: los muros, las paredes, las escaleras y rampa con sus descansos en sus posiciones originales. No agregues elementos a la construcción, como mucho un toldo o estructura para tapar del sol. Puedes agregar luces o farolas que ayuden a la iluminación en la noche así como elementos de construcción. Lo importante es que respetes íntegramente el espacio, medidas, alturas, cotas, etc.',
    objetivo ? `Objetivo adicional: ${objetivo}.` : '',
    instruccion ? `Indicaciones adicionales: ${instruccion}.` : '',
    'Te paso la información del proyecto en json:',
    JSON.stringify(furnitureDesignContext(document), null, 2),
  ].filter(Boolean).join('\n\n');
}
