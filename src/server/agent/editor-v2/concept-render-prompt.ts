import type { Estilo } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import { furnitureDesignContext } from '@/lib/editor-document/furniture-context';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { ceilingDesignContext, CEILING_RENDER_POLICY } from '@/lib/editor-document/ceiling-design-context';
import { designSpaceKindLabel } from '@/lib/design-space-kind';
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
  const overhead = buildingDocuments(document).map((level) => ({
    id: level.id, elevationM: level.elevationMm / 1000, ...ceilingDesignContext(level.document),
  }));
  const hasOverhead = overhead.some((level) => level.ceilings.length || level.luminaires.length);
  if (hasOverhead) return [
    `Crea un diseño ${estiloLabel(estilo).toLocaleLowerCase('es-ES')} para ${document.designSpaceKind ? designSpaceKindLabel(document.designSpaceKind) : 'el espacio del proyecto'}.`,
    'Conserva construcción, medidas, cotas y posiciones originales. No agregues estructura ni cambies techos. Las adiciones decorativas de esta imagen conceptual son propuestas visuales, no instalaciones aceptadas.',
    CEILING_RENDER_POLICY,
    objetivo ? `Objetivo adicional: ${objetivo}.` : '',
    instruccion ? `Preferencias subordinadas a las restricciones: ${instruccion}.` : '',
    JSON.stringify({ furniture: furnitureDesignContext(document), overhead: { units: 'm', levels: overhead } }),
  ].filter(Boolean).join('\n\n');
  return [
    `Crea un diseño ${estiloLabel(estilo).toLocaleLowerCase('es-ES')} para este exterior de una casa respetando las medidas, cotas, etc.`,
    'Respeta las alturas de cada elemento: los muros, las paredes, las escaleras y rampa con sus descansos en sus posiciones originales. No agregues elementos a la construcción, como mucho un toldo o estructura para tapar del sol. Puedes agregar luces o farolas que ayuden a la iluminación en la noche así como elementos de construcción. Lo importante es que respetes íntegramente el espacio, medidas, alturas, cotas, etc.',
    objetivo ? `Objetivo adicional: ${objetivo}.` : '',
    instruccion ? `Indicaciones adicionales: ${instruccion}.` : '',
    'Te paso la información del proyecto en json:',
    JSON.stringify(furnitureDesignContext(document), null, 2),
  ].filter(Boolean).join('\n\n');
}
