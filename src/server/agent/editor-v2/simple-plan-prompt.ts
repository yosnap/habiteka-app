import type { Estilo } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import { RENDER_ADDITION_LABELS, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderSpatialContext } from './render-spatial-context';
import { lightingPhrase, PEOPLE_RULE } from './selected-view-image-prompt';
import type { ExteriorDesignElement } from '@/lib/editor-document/exterior-design-context';
import type { CriticalFixtureGroup } from '@/lib/editor-document/critical-fixtures';
import { capped, exteriorPlanSummary, fixturePlanSummary, planPlacement, pointsBox, type PlanBox } from './plan-prompt-inventory';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { propertySunPrompt } from '@/lib/editor-document/property-orientation';

/**
 * Cenital desde el plano 2D con un prompt corto. La prueba con el mismo generador mostró que la captura 3D en
 * perspectiva y un prompt de miles de caracteres empeoraban nitidez y realismo; las comprobaciones de fidelidad se
 * quedan en la auditoría posterior. Exterior, vehículos y sanitarios se nombran en frases breves: con su inventario
 * JSON (v4) el prompt pasaba de 20 000 caracteres y los generadores lo rechazaban o reinventaban la planta.
 */
export const SIMPLE_PLAN_PROMPT_VERSION = 'habiteka-plan-simple-v7';

/** Por debajo de los 5000 caracteres de Flux: superarlos manda la cenital al respaldo, que reinventaba la planta. */
const PROMPT_BUDGET = 4800, MAX_ROOMS_CHARS = 900;

/** Posición aproximada de cada estancia en el plano, para que el uso caiga en su sitio sin enviar coordenadas. */
function roomsBox(spatial: RenderSpatialContext): PlanBox {
  return pointsBox(spatial.levels.flatMap((level) => level.rooms)
    .flatMap((room) => room.boundary?.length ? room.boundary : [room.anchor]));
}

/** Lo que cada libertad permite añadir: Controlado y Libre eran idénticos en la cenital. */
function freedomRule(options: RenderDesignOptions, hasFurniture: boolean): string {
  if (options.freedom === 'strict') return 'Conserva solo el mobiliario dibujado en el plano, sin añadir otros muebles ni objetos.';
  if (options.freedom === 'controlled') return options.additions.length
    ? `Además del mobiliario dibujado, solo puedes añadir: ${options.additions.map((item) => RENDER_ADDITION_LABELS[item].toLowerCase()).join(', ')}.`
    : 'No añadas objetos al mobiliario dibujado.';
  return hasFurniture ? 'Completa la decoración según el uso de cada estancia, sin construir ni cerrar espacios.'
    : 'Amuebla y decora cada estancia según su uso, sin construir ni cerrar espacios.';
}

export function simplePlanPrompt(style: Estilo, options: RenderDesignOptions, objective: string, instruction: string,
  spatial: RenderSpatialContext, furniture: string[] = [], exterior: ExteriorDesignElement[] = [], fixtures: CriticalFixtureGroup[] = [],
  planBox?: PlanBox, document?: EditorDocument): string {
  const box = roomsBox(spatial);
  const rooms = capped(spatial.levels.flatMap((level) => level.rooms).map((room) => `${room.name} (${planPlacement(room.anchor, box)})`), MAX_ROOMS_CHARS);
  const preferences = [objective, instruction].map((text) => text.trim()).filter(Boolean).join('. ').slice(0, 600);
  const FURNITURE = '\u0000'; // Hueco de la línea de muebles: su tope depende del resto del prompt.
  const lines = [
    `Crea un diseño de interiores ${estiloLabel(style)} realista con vista cenital a partir del plano de la imagen: una maqueta fotorrealista vista desde arriba, sin techo, con el mobiliario y los acabados de un inmueble real.`,
    'Importante: mantén la estructura del edificio tal como está en el plano: paredes, puertas con su lado y su giro, ventanas, medidas, proporciones y estancias. No añadas, quites ni muevas muros, puertas ni ventanas.',
    // El arco de giro se materializaba como un tablón curvo entre los dos marcos: el plano ya solo dibuja la hoja.
    'Cada puerta del plano se dibuja con su hoja abierta en su ángulo: represéntala como una tabla rígida y recta con su bisagra en el mismo marco, sin arcos ni piezas curvas entre los marcos; el suelo del barrido queda libre y visible.',
    ...(rooms ? [`Estancias: ${rooms}.`] : []),
    ...(furniture.length ? [FURNITURE] : []),
    freedomRule(options, furniture.length > 0),
    ...exteriorPlanSummary(exterior, planBox ?? pointsBox(exterior.flatMap((item) => item.footprint))),
    ...fixturePlanSummary(fixtures, box),
    `Iluminación: ${lightingPhrase(options)}.`,
    ...(document && propertySunPrompt(document, options.lighting) ? [propertySunPrompt(document, options.lighting)] : []),
    ...(options.people ? [PEOPLE_RULE] : []),
    ...(preferences ? [`Preferencias: ${preferences}.`] : []),
    'Sin textos, rótulos, cotas ni marcos.',
  ];
  // Los muebles del editor son el diseño base: el plano los dibuja con almohadas y respaldos para fijar su orientación.
  // Se llevan el espacio que dejan las demás líneas; lo que no quepa sigue dibujado en el plano.
  const head = 'Respeta los muebles dibujados, con su posición, tamaño y orientación: ';
  const furnitureBudget = PROMPT_BUDGET - lines.filter((line) => line !== FURNITURE).join('\n').length - head.length - 2;
  return lines.map((line) => line === FURNITURE ? `${head}${capped(furniture, Math.max(0, furnitureBudget))}.` : line).join('\n');
}

export const SIMPLE_SECTION_PROMPT_VERSION = 'habiteka-section-simple-v7';

const SIDE: Record<string, string> = { front: 'el frente', back: 'la trasera', left: 'la izquierda', right: 'la derecha' };

/**
 * Alzado como maqueta abierta a la altura de los ojos, desde la sección 2D: el mismo principio que la cenital (dibujo
 * técnico con la misma perspectiva que el resultado). La imagen 2 es la cenital aceptada recortada y girada.
 */
export function simpleSectionPrompt(side: string, style: Estilo, options: RenderDesignOptions, objective: string,
  instruction: string, rooms: string[], furniture: string[] = [], visibilityHints: string[] = [], document?: EditorDocument): string {
  const preferences = [objective, instruction].map((text) => text.trim()).filter(Boolean).join('. ').slice(0, 400);
  return [
    `Crea una vista fotorrealista ${estiloLabel(style)} de este inmueble como una maqueta abierta vista desde ${SIDE[side] ?? 'un lateral'}, a la altura de los ojos, a partir de la sección técnica de la imagen 1: se ha retirado esa fachada con sus ventanas, puertas, cortinas y todo lo que estaba pegado a ella, y se ve el interior de cada estancia.`,
    'Importante: mantén exactamente la sección: suelo, tabiques cortados (bandas oscuras) y paredes del fondo con sus puertas, ventanas y pasos, en su posición y con su tamaño. No cierres el frente, no añadas muros, puertas ni ventanas, ni pisos o altillos.',
    'La maqueta está abierta por arriba, sin techo ni tejado. No añadas losas, vigas continuas, bloques ni bandas horizontales que cierren su parte superior. Conserva únicamente la coronación de cada muro real.',
    `La imagen 2 es el diseño interior aceptado visto desde arriba; su borde inferior es este frente. Cada estancia tiene sus mismos muebles, colores y acabados, con la misma orientación.${rooms.length ? ` Estancias de izquierda a derecha: ${rooms.join(', ')}.` : ''}`,
    'Conserva exactamente los sanitarios y placas de cocción visibles del diseño aceptado: mismo número y función, sin duplicar inodoros ni omitir la vitrocerámica. No añadas elementos ocultos para mostrarlos en este corte.',
    ...rooms.flatMap((name, index) => visibilityHints[index] ? [`Visibilidad de ${name}: ${visibilityHints[index]}`] : []),
    // La lectura previa de la cenital dice cómo se ve cada mueble; sin ella queda la regla general de las camas.
    ...(furniture.length ? [`Mobiliario visto desde esta cámara, leído del diseño aceptado de la imagen 2: ${furniture.join('; ')}.`]
      : ['Una cama con el cabecero junto a la fachada retirada se ve de espaldas, con el cabecero delante y los pies hacia el fondo; con el cabecero en un tabique lateral se ve de perfil.']),
    'Encuadre: el de la imagen 1, de frente y a la altura de los ojos; nunca una vista aérea ni una planta.',
    ...(options.people ? [PEOPLE_RULE] : []),
    `Iluminación: ${lightingPhrase(options)}.`,
    ...(document && propertySunPrompt(document, options.lighting) ? [propertySunPrompt(document, options.lighting)] : []),
    ...(preferences ? [`Preferencias: ${preferences}.`] : []),
    'Fondo neutro alrededor de la maqueta. Sin textos, rótulos, cotas ni marcos.',
  ].join('\n');
}
