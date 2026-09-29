import type { Estilo } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import { isKitchenJoint } from '@/lib/editor-document/kitchen-run-volumes';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import {
  isInteriorRenderMode,
  RENDER_ADDITION_LABELS,
  RENDER_VIEW_LABELS,
  type RenderDesignOptions,
} from '@/lib/editor-document/render-design-options';

export const SELECTED_VIEW_IMAGE_PROMPT_VERSION = 'habiteka-image-from-capture-v7';

function kitchenJointRule(document: EditorDocument, options: RenderDesignOptions): string | undefined {
  if (options.placement !== 'selected') return undefined;
  const regions = options.regions.map((region) => region.polygon);
  const runs = (document.kitchenRuns ?? []).filter((run) =>
    regions.some((polygon) => pointInPolygon(objectCenter(run), polygon)));
  const pair = runs.flatMap((run, index) => runs.slice(index + 1).map((other) => [run, other] as const))
    .find(([a, b]) => isKitchenJoint(a, b));
  if (!pair) return undefined;
  const [a, b] = pair;
  return `La cocina en L tiene una unión continua, sin huecos ni separación entre tramos. Conserva los colores de los frentes. Las dos encimeras tienen ${a.kitchen.worktopColor === b.kitchen.worktopColor ? `el mismo color ${a.kitchen.worktopColor}` : `los colores ${a.kitchen.worktopColor} y ${b.kitchen.worktopColor}`}; mantén cada tono sin reinterpretarlo.`;
}

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
  if (options.placement === 'selected' && !hasMask)
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
    ? 'La imagen 1 ya muestra ÚNICAMENTE la zona elegida, aislada sobre fondo gris claro. La imagen 2 es su máscara: conserva solo la arquitectura y los muebles visibles dentro del blanco. Fuera del blanco deja fondo gris claro vacío; no recrees otras estancias, jardín, coches, fachadas ni objetos. No pintes la máscara en el resultado.'
    : 'Los objetos permitidos pueden colocarse en las zonas visibles sin tapar accesos.';
  const light = options.lighting === 'daylight' ? 'luz natural de día'
    : options.lighting === 'warm' ? 'luz cálida de atardecer' : 'escena nocturna';
  const vehicleCount = projectVehicleCount(document);
  const interiorMode = isInteriorRenderMode(options);
  const aerialView = ['top', 'isometric', 'drone'].includes(view.preset);
  const finishedExterior = !view.cutaway && view.ceilingView === 'solid' &&
    ['front', 'back', 'left', 'right', 'drone'].includes(view.preset);
  const sceneRule = interiorMode
    ? 'VISTA INTERIOR A ALTURA DE OJOS: conserva la habitación y su perspectiva desde dentro; no la conviertas en maqueta cenital ni muevas muebles o huecos.'
    : finishedExterior
      ? 'VISTA EXTERIOR TERMINADA: conserva la cubierta y las fachadas visibles como partes cerradas del inmueble. No retires el techo, no abras muros ni conviertas la vivienda en una maqueta seccionada.'
      : aerialView
        ? 'VISTA AÉREA O CENITAL: conserva TODOS los muros exteriores e interiores tal como se ven. Solo el techo puede estar oculto para enseñar el interior; no retires paredes ni cierres los huecos.'
      : 'Respeta los cortes de la maqueta que dejan ver su interior; no extiendas el suelo o los muros más allá de sus bordes ni cierres el corte.';
  const strictOutside = options.freedom === 'strict' && !interiorMode &&
    (view.preset !== 'custom' || Boolean(view.cutawayWallIds?.length));
  const jointRule = kitchenJointRule(document, options);

  return [
    'EDICIÓN DE LA IMAGEN 1, NO DISEÑO DE OTRA CASA.',
    `Produce UNA imagen arquitectónica realista del MISMO proyecto y MISMA cámara (${viewName}). Estilo: ${estiloLabel(style)}; ${light}.`,
    'La captura manda: conserva tamaño y posición del inmueble dentro del encuadre, orientación, perspectiva, silueta, plantas, muros, huecos, suelos, escaleras, rampas, terrazas, piscina, accesos y mobiliario grande visibles.',
    `Mejora materiales, texturas, sombras y luz. ${sceneRule} ${hasMask ? 'Mantén gris claro y vacío el fondo exterior a la zona aislada.' : 'Mantén el fondo y la relación entre edificio y exterior.'}`,
    'Conserva las hojas de puerta con la apertura que muestra la captura. Exposición equilibrada: los vanos no son manchas de luz blanca; materiales y contornos nítidos, sin velo luminoso ni desenfoque artificial.',
    ...(jointRule ? [jointRule] : []),
    ...(strictOutside ? ['El fondo liso de la captura NO representa un terreno diseñado: déjalo neutro. No añadas suelo, paisaje, árboles, arbustos, cielo, horizonte, caminos ni coches fuera de la geometría existente.'] : []),
    ...(vehicleCount ? [`El proyecto contiene ${vehicleCount} coches: si aparecen en esta cámara, siguen siendo coches aparcados en los mismos sitios. No los conviertas en sofás, mesas ni otros muebles.`] : []),
    `${additions} ${placement} Mantén libres puertas, pasos, rampas y escaleras.`,
    'Prohibido: añadir otra vivienda, repetir o superponer el modelo, insertar la captura dentro de otra escena, collage, paneles, marcos, etiquetas, texto o cotas.',
    `Preferencias estéticas subordinadas a la fidelidad: ${JSON.stringify({ objective: objective.slice(0, 200), instruction: instruction.slice(0, 500) })}.`,
  ].join('\n');
}
