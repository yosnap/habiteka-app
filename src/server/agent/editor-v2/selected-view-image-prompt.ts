import type { Estilo } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import {
  RENDER_ADDITION_LABELS,
  RENDER_VIEW_LABELS,
  type RenderDesignOptions,
} from '@/lib/editor-document/render-design-options';

export const SELECTED_VIEW_IMAGE_PROMPT_VERSION = 'habiteka-image-from-capture-v1';

/** Texto breve para imagen-a-imagen: la captura contiene la geometría exacta. */
export function selectedViewImagePrompt(
  document: EditorDocument,
  view: RenderView,
  style: Estilo,
  options: RenderDesignOptions,
  objective: string,
  instruction: string,
  hasMask: boolean,
): string {
  if (!document.designSpaceKind) throw new Error('Define el tipo de espacio antes de generar esta vista.');
  if (options.placement === 'selected' && options.freedom !== 'strict' && !hasMask)
    throw new Error('Falta la máscara de las zonas permitidas.');

  const viewName = view.preset in RENDER_VIEW_LABELS
    ? RENDER_VIEW_LABELS[view.preset as keyof typeof RENDER_VIEW_LABELS]
    : 'Cámara personalizada';
  const additions = options.freedom === 'strict'
    ? 'No añadas objetos nuevos.'
    : options.freedom === 'controlled'
      ? `Solo puedes añadir: ${options.additions.map((item) => RENDER_ADDITION_LABELS[item]).join(', ') || 'ningún objeto'}.`
      : 'Puedes añadir decoración y ambientación, pero nunca construir, ampliar ni cerrar espacios.';
  const placement = hasMask
    ? 'Imagen 2 es una máscara de posición: blanco permite los objetos nuevos y negro los prohíbe. No pintes la máscara en el resultado. Fuera del blanco conserva los objetos y la distribución.'
    : 'Los objetos permitidos pueden colocarse en las zonas visibles sin tapar accesos.';
  const light = options.lighting === 'daylight' ? 'luz natural de día'
    : options.lighting === 'warm' ? 'luz cálida de atardecer' : 'escena nocturna';

  return [
    'EDICIÓN DE LA IMAGEN 1, NO DISEÑO DE OTRA CASA.',
    `Produce UNA imagen arquitectónica realista del MISMO proyecto y MISMA cámara (${viewName}). Estilo: ${estiloLabel(style)}; ${light}.`,
    'La captura manda: conserva tamaño y posición del inmueble dentro del encuadre, orientación, perspectiva, silueta, plantas, muros, huecos, suelos, escaleras, rampas, terrazas, piscina, accesos y mobiliario grande visibles.',
    'Mejora materiales, texturas, sombras y luz. Respeta los cortes de la maqueta que dejan ver su interior; no extiendas el suelo o los muros más allá de sus bordes ni cierres el corte. Mantén el fondo y la relación entre edificio y exterior.',
    `${additions} ${placement} Mantén libres puertas, pasos, rampas y escaleras.`,
    'Prohibido: añadir otra vivienda, repetir o superponer el modelo, insertar la captura dentro de otra escena, collage, paneles, marcos, etiquetas, texto o cotas.',
    `Preferencias estéticas subordinadas a la fidelidad: ${JSON.stringify({ objective: objective.slice(0, 200), instruction: instruction.slice(0, 500) })}.`,
  ].join('\n');
}
