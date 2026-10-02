import type { Estilo } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import { renderViewVisibilityRule } from '@/lib/editor-document/render-view-visibility';
import { requestedRenderRedesign, RENDER_REDESIGN_RULE } from '@/lib/editor-document/render-redesign';
import { isKitchenJoint } from '@/lib/editor-document/kitchen-run-volumes';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { designMaterialPalette } from '@/lib/editor-document/design-material-palette';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { FURNITURE_USE_RULE } from '@/lib/editor-document/render-review';
import {
  isInteriorRenderMode,
  RENDER_ADDITION_LABELS,
  RENDER_VIEW_LABELS,
  type RenderDesignOptions,
} from '@/lib/editor-document/render-design-options';

/** La decoración añadida tiene que ser la de una casa habitada de verdad: sin objetos en sitios imposibles. */
const DECOR_SENSE_RULE = 'Decoración con sentido: nada sobre placas de cocina, fregaderos, inodoros, duchas ni escaleras; las plantas van en el suelo, en mesas, estanterías o jardineras, nunca sobre sillas, camas ni electrodomésticos; ningún mueble flota, atraviesa muros ni tapa puertas o ventanas. Si un objeto no tiene un sitio lógico, no lo añadas.';

export const SELECTED_VIEW_IMAGE_PROMPT_VERSION = 'habiteka-image-from-capture-v16';

/**
 * Cada vista se genera en una consulta independiente: sin esto el modelo reinventa materiales y tonos en cada una.
 * Fija los acabados que ya lleva el diseño editable para que todas las vistas enseñen el mismo.
 */
export function designContractRule(document: EditorDocument): string | undefined {
  const palette = designMaterialPalette(document);
  const label = (id: string) => (surfaceMaterial(id) as { label?: string } | undefined)?.label ?? id;
  const part = (name: string, ids: string[]) => ids.length ? `${name}: ${ids.slice(0, 3).map(label).join(' / ')}` : '';
  const parts = [part('muros', palette.walls), part('suelos', palette.floors), part('escaleras', palette.stairs),
    part('rampas', palette.ramps), part('columnas', palette.columns)].filter(Boolean);
  if (!parts.length) return undefined;
  return `DISEÑO FIJADO, IGUAL EN TODAS LAS VISTAS. Acabados del proyecto — ${parts.join('; ')}. Esta imagen es solo una vista de un mismo diseño: usa exactamente estos materiales y los colores de la captura, sin cambiar el tono ni el material de ninguna superficie ni inventar variantes respecto a otras vistas.`;
}

/** La ancla es una vista ya aceptada del mismo diseño desde otra cámara: da materiales y ambiente, nunca encuadre. */
const ANCHOR_RULE = (position: number) => `La imagen ${position} es otra vista ya aceptada del MISMO diseño, tomada desde otra cámara. Úsala SOLO como referencia de materiales, colores, acabados, identidad del mobiliario y ambiente. Cuando se ve el mismo mueble, conserva su diseño aceptado; no inventes otro interiorismo para cada cámara. La cámara, la perspectiva y la geometría son las de la imagen 1: no copies el encuadre ni la composición de la imagen ${position}.`;

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
  hasAnchor = false,
  hasEnvironment = false,
): string {
  if (!document.designSpaceKind) throw new Error('Define el tipo de espacio antes de generar esta vista.');
  if ((options.placement === 'selected' || options.designScope === 'house') && !hasMask)
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
    : options.lighting === 'afternoon' ? 'luz natural de tarde, sol bajo y sombras largas, todavía de día'
    : options.lighting === 'warm' ? 'luz cálida de atardecer' : 'escena nocturna';
  const vehicleCount = projectVehicleCount(document);
  const interiorMode = isInteriorRenderMode(options);
  const aerialView = ['top', 'isometric', 'drone'].includes(view.preset);
  const finishedExterior = !view.cutaway && view.ceilingView === 'solid' &&
    ['front', 'back', 'left', 'right', 'drone', 'exterior'].includes(view.preset);
  const sceneRule = interiorMode
    ? 'VISTA INTERIOR A ALTURA DE OJOS: conserva la habitación y su perspectiva desde dentro; no la conviertas en maqueta cenital ni muevas huecos.'
    : finishedExterior
      ? 'VISTA EXTERIOR TERMINADA: conserva la cubierta y las fachadas visibles como partes cerradas del inmueble. No retires el techo, no abras muros ni conviertas la vivienda en una maqueta seccionada.'
      : aerialView
        ? 'VISTA AÉREA O CENITAL: conserva TODOS los muros exteriores e interiores tal como se ven. Solo el techo puede estar oculto para enseñar el interior; no retires paredes ni cierres los huecos.'
      : 'Respeta los cortes de la maqueta que dejan ver su interior; no extiendas el suelo o los muros más allá de sus bordes ni cierres el corte.';
  const strictOutside = !hasEnvironment && options.freedom === 'strict' && !interiorMode &&
    (view.preset !== 'custom' || Boolean(view.cutawayWallIds?.length));
  const jointRule = options.redesignFixed ? undefined : kitchenJointRule(document, options);
  const redesign = requestedRenderRedesign(options, objective, instruction);
  const contractRule = redesign ? undefined : designContractRule(document);

  return [
    'EDICIÓN DE LA IMAGEN 1, NO DISEÑO DE OTRA CASA.',
    `Produce UNA imagen arquitectónica realista del MISMO proyecto y MISMA cámara (${viewName}). Estilo: ${estiloLabel(style)}; ${light}.`,
    'La captura manda: conserva tamaño y posición del inmueble dentro del encuadre, orientación, perspectiva, silueta, plantas, muros, huecos, suelos, escaleras, rampas, terrazas, piscina y accesos visibles.',
    ...(redesign ? [RENDER_REDESIGN_RULE] : []),
    options.redesignFixed
      ? 'REDISEÑO DE FIJOS AUTORIZADO: puedes sustituir cocina, isla, sanitarios y armarios empotrados y sus acabados dentro de la zona permitida. Conserva el uso de cada estancia, instalaciones, muros, huecos y accesos; este permiso no autoriza obras de geometría.'
      : 'FIJOS PROTEGIDOS: conserva cocina, isla, sanitarios y armarios empotrados, incluidos su forma, posición y acabados. Las instrucciones estéticas no autorizan sustituirlos.',
    'Puedes sustituir muebles móviles (sofás, mesas, sillas, lámparas, alfombras y cortinas) dentro del ámbito; respeta la escala, el uso y todos los pasos.',
    FURNITURE_USE_RULE,
    ...(document.designSpaceKind === 'casa' ? ['CASA COMPLETA significa solo la vivienda y sus fachadas. Conserva el terreno y jardín sin rediseñarlos; no añadas paisaje ni mobiliario exterior por instrucciones para la casa.'] : []),
    `Mejora materiales, texturas, sombras y luz. ${sceneRule} ${hasMask ? 'Mantén gris claro y vacío el fondo exterior a la zona aislada.' : 'Mantén el fondo y la relación entre edificio y exterior.'}`,
    renderViewVisibilityRule(view),
    'Conserva las hojas de puerta con la apertura que muestra la captura. Exposición equilibrada: los vanos no son manchas de luz blanca; materiales y contornos nítidos, sin velo luminoso ni desenfoque artificial.',
    ...(contractRule ? [contractRule] : []),
    ...(hasAnchor ? [ANCHOR_RULE(hasMask ? 3 : 2)] : []),
    ...(hasAnchor && ['drone', 'isometric', 'exterior'].includes(view.preset) ? ['VISTA LEJANA CON IDENTIDAD COMPLETA: conserva volumen, plantas, cubierta, huecos, terrazas, pérgolas y todos los elementos arquitectónicos de la referencia aceptada. No simplifiques detalles; la imagen 1 fija la cámara.'] : []),
    ...(hasEnvironment ? [
      `La imagen ${hasMask ? 4 : 3} es la ortofoto real de la parcela: úsala exclusivamente como entorno, conservando límites, caminos y vegetación. No copies edificios de la ortofoto sobre la casa del proyecto.`,
      'DRON CON IDENTIDAD COMPLETA: la vista aceptada fija la identidad del inmueble. Conserva volumen, plantas, cubierta, huecos, terrazas, pérgolas, carpas, piscina, accesos y todos los elementos visibles. No simplifiques ni suprimas detalles para cambiar de perspectiva. La imagen 1 fija la cámara y posición del inmueble.',
      ...(document.geographicSite?.confirmed ? [
        `ENCAJE CONFIRMADO SOBRE LA PARCELA: conserva la posición y orientación de la captura. La ortofoto tiene norte arriba y ancho ${document.geographicSite.groundWidthM} m; centro del plano normalizado ${JSON.stringify(document.geographicSite.anchor)}, giro horario ${document.geographicSite.rotationDeg} grados. Intervención: ${document.geographicSite.scenario}; solo se puede sustituir contenido dentro de ${JSON.stringify(document.geographicSite.intervention)}. No cambies el entorno fuera del contorno.`,
      ] : []),
    ] : []),
    ...(jointRule ? [jointRule] : []),
    ...(strictOutside ? ['El fondo liso de la captura NO representa un terreno diseñado: déjalo neutro. No añadas suelo, paisaje, árboles, arbustos, cielo, horizonte, caminos ni coches fuera de la geometría existente.'] : []),
    ...(vehicleCount ? [`El proyecto contiene ${vehicleCount} coches: si aparecen en esta cámara, siguen siendo coches aparcados en los mismos sitios. No los conviertas en sofás, mesas ni otros muebles.`] : []),
    `${additions} ${placement} Mantén libres puertas, pasos, rampas y escaleras.`,
    ...(options.freedom !== 'strict' ? [DECOR_SENSE_RULE] : []),
    'Prohibido: añadir otra vivienda, repetir o superponer el modelo, insertar la captura dentro de otra escena, collage, paneles, marcos, etiquetas, texto o cotas.',
    `Preferencias estéticas subordinadas a la fidelidad: ${JSON.stringify({ objective: objective.slice(0, 200), instruction: instruction.slice(0, 500) })}.`,
  ].join('\n');
}
