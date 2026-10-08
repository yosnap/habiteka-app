import type { EditorTool } from '@/canvas/editor-v2/store';
import type { Stair } from '@/lib/editor-document/schema';
import type { ConstructionPhotoId } from './construction-photos';

export type RoomShape = 'L' | 'U' | 'T';
/** Lo que hace cada ficha: siempre una herramienta o un comando real del editor. */
export type ConstructionCardAction =
  | { type: 'tool'; tool: EditorTool }
  | { type: 'room-shape'; shape: RoomShape }
  | { type: 'stair'; kind: Stair['kind'] }
  | { type: 'ramp' }
  | { type: 'landing' }
  | { type: 'column' }
  | { type: 'coming-soon' };
export interface ConstructionCard { id: string; label: string; detail: string; photo: ConstructionPhotoId; action: ConstructionCardAction }
export interface ConstructionSection { title: string; intro?: string; cards: ConstructionCard[] }
/** Apartados de Construir que se resuelven con fichas propias (exterior, puertas y ventanas tienen catálogo aparte). */
export type ConstructionCardCategory = 'patio' | 'walls' | 'rooms' | 'kitchen' | 'shapes' | 'passages' | 'stairs' | 'ramps' | 'columns';

const SHAPES: readonly RoomShape[] = ['L', 'U', 'T'];
const lower = (shape: RoomShape) => shape.toLowerCase() as 'l' | 'u' | 't';
const STAIRS: Record<Stair['kind'], { label: string; photo: ConstructionPhotoId }> = {
  straight: { label: 'Escalera recta', photo: 'escalera-recta' },
  L: { label: 'Escalera en L', photo: 'escalera-l' },
  U: { label: 'Escalera en U', photo: 'escalera-u' },
};

const SECTIONS: Record<ConstructionCardCategory, ConstructionSection> = {
  patio: {
    title: 'Patio / terraza',
    intro: 'Dibuja un área abierta. Pulsa su suelo para elegir césped, tierra, gravilla o pavimento. Los elementos se añaden desde Construir → Exterior y jardín.',
    cards: [{ id: 'patio', label: 'Superficie exterior', detail: 'Clics para cerrar el contorno', photo: 'patio', action: { type: 'tool', tool: 'patio' } }],
  },
  walls: {
    title: 'Dibujar paredes', intro: 'Dibuja el contorno de tu espacio o un tramo abierto',
    cards: [
      { id: 'wall', label: 'Pared recta', detail: 'Dibujar en el lienzo', photo: 'pared', action: { type: 'tool', tool: 'wall' } },
      { id: 'guard-wall', label: 'Murete de protección', detail: 'Tramo independiente de 1,10 m; se apoya en el descansillo', photo: 'murete',
        action: { type: 'tool', tool: 'guard-wall' } },
    ],
  },
  rooms: {
    title: 'Habitaciones', intro: 'Dibuja una habitación cerrada',
    cards: [
      { id: 'rectangle', label: 'Habitación rectangular', detail: 'Arrastra entre dos esquinas', photo: 'habitacion', action: { type: 'tool', tool: 'rectangle' } },
      ...SHAPES.map((shape): ConstructionCard => ({ id: `room-${shape}`, label: `Habitación en ${shape}`, detail: 'Contorno cerrado editable',
        photo: `habitacion-${lower(shape)}`, action: { type: 'room-shape', shape } })),
    ],
  },
  kitchen: {
    title: 'Cocina',
    intro: 'Trázalo como una pared, pegado al muro: módulos bajos con encimera. Después añade aparatos y módulos altos desde Propiedades.',
    cards: [{ id: 'kitchen', label: 'Mueble lineal de cocina', detail: 'Clics por tramos pegados al muro', photo: 'cocina', action: { type: 'tool', tool: 'kitchen' } }],
  },
  shapes: {
    title: 'Formas', intro: 'Figuras independientes para modelar el espacio; no crean habitaciones.',
    cards: SHAPES.map((shape) => ({ id: `shape-${shape}`, label: `Forma ${shape}`, detail: 'Próximamente', photo: `forma-${lower(shape)}`,
      action: { type: 'coming-soon' } })),
  },
  passages: {
    title: 'Huecos', intro: 'Una abertura sin carpintería',
    cards: [{ id: 'passage', label: 'Paso abierto', detail: 'Elegir y colocar', photo: 'paso-abierto', action: { type: 'tool', tool: 'passage' } }],
  },
  stairs: {
    title: 'Escaleras',
    cards: [
      ...(Object.keys(STAIRS) as Stair['kind'][]).map((kind): ConstructionCard => ({ id: `stair-${kind}`, label: STAIRS[kind].label,
        detail: 'Añadir al plano', photo: STAIRS[kind].photo, action: { type: 'stair', kind } })),
      { id: 'landing', label: 'Descansillo', detail: 'Plataforma común para rampas y escaleras', photo: 'descansillo', action: { type: 'landing' } },
    ],
  },
  ramps: {
    title: 'Rampas', intro: 'Superficie inclinada continua para salvar desniveles.',
    cards: [
      { id: 'ramp', label: 'Rampa recta', detail: 'Añadir al plano', photo: 'rampa', action: { type: 'ramp' } },
      { id: 'landing', label: 'Descansillo', detail: 'Plataforma horizontal independiente', photo: 'descansillo', action: { type: 'landing' } },
    ],
  },
  columns: {
    title: 'Columnas', intro: 'Soporte estructural independiente de los muros.',
    cards: [{ id: 'column', label: 'Columna rectangular', detail: '40 × 40 cm, ajustable', photo: 'columna', action: { type: 'column' } }],
  },
};

export function constructionSection(category: ConstructionCardCategory): ConstructionSection {
  return SECTIONS[category];
}
