import type { Estilo } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import {
  isInteriorRenderMode,
  RENDER_ADDITION_LABELS,
  RENDER_VIEW_LABELS,
  type RenderDesignOptions,
} from '@/lib/editor-document/render-design-options';

export const SELECTED_VIEW_IMAGE_PROMPT_VERSION = 'habiteka-image-from-capture-v4';

export function projectVehicleCount(document: EditorDocument): number {
  return document.furniture.filter((item) => /^(coche|auto|autom[oó]vil|veh[ií]culo)$/i.test(item.kind)).length;
}

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
    ? 'Imagen 2 es una máscara de posición: SOLO el blanco permite objetos nuevos. El negro está bloqueado: no añadas allí plantas, tumbonas, adornos, vehículos, muebles ni construcciones. Mantén piscina, aparcamiento, vallas y exteriores sin objetos nuevos cuando aparezcan negros. No pintes la máscara en el resultado.'
    : 'Los objetos permitidos pueden colocarse en las zonas visibles sin tapar accesos.';
  const light = options.lighting === 'daylight' ? 'luz natural de día'
    : options.lighting === 'warm' ? 'luz cálida de atardecer' : 'escena nocturna';
  const vehicleCount = projectVehicleCount(document);
  const interiorMode = isInteriorRenderMode(options);
  const finishedExterior = !view.cutaway && view.ceilingView === 'solid' &&
    ['front', 'back', 'left', 'right', 'drone'].includes(view.preset);
  const sceneRule = interiorMode
    ? 'VISTA INTERIOR A ALTURA DE OJOS: conserva la habitación y su perspectiva desde dentro; no la conviertas en maqueta cenital ni muevas muebles o huecos.'
    : finishedExterior
      ? 'VISTA EXTERIOR TERMINADA: conserva la cubierta y las fachadas visibles como partes cerradas del inmueble. No retires el techo, no abras muros ni conviertas la vivienda en una maqueta seccionada.'
      : 'Respeta los cortes de la maqueta que dejan ver su interior; no extiendas el suelo o los muros más allá de sus bordes ni cierres el corte.';
  const strictOutside = options.freedom === 'strict' && !interiorMode &&
    (view.preset !== 'custom' || Boolean(view.cutawayWallIds?.length));

  return [
    'EDICIÓN DE LA IMAGEN 1, NO DISEÑO DE OTRA CASA.',
    `Produce UNA imagen arquitectónica realista del MISMO proyecto y MISMA cámara (${viewName}). Estilo: ${estiloLabel(style)}; ${light}.`,
    'La captura manda: conserva tamaño y posición del inmueble dentro del encuadre, orientación, perspectiva, silueta, plantas, muros, huecos, suelos, escaleras, rampas, terrazas, piscina, accesos y mobiliario grande visibles.',
    `Mejora materiales, texturas, sombras y luz. ${sceneRule} Mantén el fondo y la relación entre edificio y exterior.`,
    ...(strictOutside ? ['El fondo liso de la captura NO representa un terreno diseñado: déjalo neutro. No añadas suelo, paisaje, árboles, arbustos, cielo, horizonte, caminos ni coches fuera de la geometría existente.'] : []),
    ...(vehicleCount ? [`El proyecto contiene ${vehicleCount} coches: si aparecen en esta cámara, siguen siendo coches aparcados en los mismos sitios. No los conviertas en sofás, mesas ni otros muebles.`] : []),
    `${additions} ${placement} Mantén libres puertas, pasos, rampas y escaleras.`,
    'Prohibido: añadir otra vivienda, repetir o superponer el modelo, insertar la captura dentro de otra escena, collage, paneles, marcos, etiquetas, texto o cotas.',
    `Preferencias estéticas subordinadas a la fidelidad: ${JSON.stringify({ objective: objective.slice(0, 200), instruction: instruction.slice(0, 500) })}.`,
  ].join('\n');
}
