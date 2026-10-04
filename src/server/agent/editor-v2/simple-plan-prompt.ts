import type { Estilo } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderSpatialContext } from './render-spatial-context';
import { lightingPhrase, PEOPLE_RULE } from './selected-view-image-prompt';

/**
 * Cenital desde el plano 2D con un prompt corto. La prueba con el mismo generador mostró que la captura 3D en
 * perspectiva y un prompt de miles de caracteres empeoraban nitidez y realismo; las comprobaciones de fidelidad se
 * quedan en la auditoría posterior.
 */
export const SIMPLE_PLAN_PROMPT_VERSION = 'habiteka-plan-simple-v2';

const ROWS = ['arriba', '', 'abajo'], COLUMNS = ['izquierda', 'centro', 'derecha'];

/** Posición aproximada de cada estancia en el plano, para que el uso caiga en su sitio sin enviar coordenadas. */
function roomPlacement(spatial: RenderSpatialContext): string {
  const rooms = spatial.levels.flatMap((level) => level.rooms);
  if (!rooms.length) return '';
  const xs = rooms.flatMap((room) => (room.boundary?.length ? room.boundary : [room.anchor]).map((point) => point.x));
  const ys = rooms.flatMap((room) => (room.boundary?.length ? room.boundary : [room.anchor]).map((point) => point.y));
  const minX = Math.min(...xs), spanX = Math.max(...xs) - minX, minY = Math.min(...ys), spanY = Math.max(...ys) - minY;
  // Sin extensión en un eje (una sola estancia sin contorno), la posición es el centro.
  const third = (value: number, min: number, span: number) => span > 0 ? Math.min(2, Math.max(0, Math.floor((value - min) / span * 3))) : 1;
  return rooms.map((room) => {
    const row = ROWS[third(room.anchor.y, minY, spanY)]!, column = COLUMNS[third(room.anchor.x, minX, spanX)]!;
    const where = row ? (column === 'centro' ? row : `${row} ${column}`) : column;
    return `${room.name} (${where})`;
  }).join('; ');
}

export function simplePlanPrompt(style: Estilo, options: RenderDesignOptions, objective: string, instruction: string,
  spatial: RenderSpatialContext, furniture: string[] = []): string {
  const rooms = roomPlacement(spatial);
  const preferences = [objective, instruction].map((text) => text.trim()).filter(Boolean).join('. ').slice(0, 600);
  return [
    `Crea un diseño de interiores ${estiloLabel(style)} realista con vista cenital a partir del plano de la imagen: una maqueta fotorrealista vista desde arriba, sin techo, con el mobiliario y los acabados de un inmueble real.`,
    'Importante: mantén la estructura del edificio tal como está en el plano: paredes, puertas con su lado y su giro, ventanas, medidas, proporciones y estancias. No añadas, quites ni muevas muros, puertas ni ventanas.',
    ...(rooms ? [`Estancias: ${rooms}. ${furniture.length ? 'Completa la decoración según su uso.' : 'Amuebla cada una según su uso.'}`] : []),
    // Los muebles del editor son el diseño base: el plano los dibuja con almohadas y respaldos para fijar su orientación.
    ...(furniture.length ? [`Respeta los muebles dibujados, con su posición, tamaño y orientación: ${furniture.join('; ')}.`] : []),
    `Iluminación: ${lightingPhrase(options)}.`,
    ...(options.freedom === 'strict' ? ['Conserva solo el mobiliario dibujado en el plano, sin añadir otros muebles.'] : []),
    ...(options.people ? [PEOPLE_RULE] : []),
    ...(preferences ? [`Preferencias: ${preferences}.`] : []),
    'Sin textos, rótulos, cotas ni marcos.',
  ].join('\n');
}

export const SIMPLE_SECTION_PROMPT_VERSION = 'habiteka-section-simple-v5';

const SIDE: Record<string, string> = { front: 'el frente', back: 'la trasera', left: 'la izquierda', right: 'la derecha' };

/**
 * Alzado como maqueta abierta a la altura de los ojos, desde la sección 2D: el mismo principio que la cenital (dibujo
 * técnico con la misma perspectiva que el resultado). La imagen 2 es la cenital aceptada recortada y girada.
 */
export function simpleSectionPrompt(side: string, style: Estilo, options: RenderDesignOptions, objective: string,
  instruction: string, rooms: string[], furniture: string[] = [], drawn = false): string {
  const preferences = [objective, instruction].map((text) => text.trim()).filter(Boolean).join('. ').slice(0, 400);
  return [
    `Crea una vista fotorrealista ${estiloLabel(style)} de este inmueble como una maqueta abierta vista desde ${SIDE[side] ?? 'un lateral'}, a la altura de los ojos, a partir de la sección técnica de la imagen 1: se ha retirado esa fachada con sus ventanas, puertas, cortinas y todo lo que estaba pegado a ella, y se ve el interior de cada estancia.`,
    'Importante: mantén exactamente la sección: suelo, techo, tabiques cortados (bandas oscuras) y paredes del fondo con sus puertas, ventanas y pasos, en su posición y con su tamaño. No cierres el frente, no añadas muros, puertas ni ventanas, ni pisos o altillos.',
    `La imagen 2 es el diseño interior aceptado visto desde arriba; su borde inferior es este frente. Cada estancia tiene sus mismos muebles, colores y acabados, con la misma orientación.${rooms.length ? ` Estancias de izquierda a derecha: ${rooms.join(', ')}.` : ''}`,
    // La lectura previa de la cenital dice cómo se ve cada mueble; sin ella queda la regla general de las camas.
    ...(furniture.length ? [`${drawn ? 'Los muebles dibujados en la imagen 1 van en esa posición, con ese tamaño y esa orientación. ' : ''}Mobiliario visto desde esta cámara: ${furniture.join('; ')}.`]
      : ['Una cama con el cabecero junto a la fachada retirada se ve de espaldas, con el cabecero delante y los pies hacia el fondo; con el cabecero en un tabique lateral se ve de perfil.']),
    'Encuadre: el de la imagen 1, de frente y a la altura de los ojos; nunca una vista aérea ni una planta.',
    ...(options.people ? [PEOPLE_RULE] : []),
    `Iluminación: ${lightingPhrase(options)}.`,
    ...(preferences ? [`Preferencias: ${preferences}.`] : []),
    'Fondo neutro alrededor de la maqueta. Sin textos, rótulos, cotas ni marcos.',
  ].join('\n');
}
