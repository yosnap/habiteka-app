/** Imagen generada disponible para el montaje, con lo justo para decidir si entra y en qué orden. */
export interface TourImage {
  id: string;
  ambient: string;
  view: string;
  lighting: string;
  freedom: string;
  revision: number;
  createdAt: string;
  url: string;
}

export const TOUR_SHOT_MS = 3200;
export const TOUR_FADE_MS = 800;
export const MAX_TOUR_SHOTS = 24;
/** Ámbito de las imágenes que abarcan todo el inmueble; abren el montaje. */
export const WHOLE_PROPERTY = 'Inmueble completo';

// Exteriores y vuelos primero; después las vistas de estudio de cada ambiente.
const VIEW_ORDER = ['drone', 'front', 'back', 'left', 'right', 'isometric', 'top', 'custom'];
const viewRank = (view: string) => { const index = VIEW_ORDER.indexOf(view); return index === -1 ? VIEW_ORDER.length : index; };
// Entre varias imágenes equivalentes gana la de día, después la más fiel al plano y la más reciente.
const FREEDOM_RANK: Record<string, number> = { strict: 0, controlled: 1, free: 2 };
const better = (a: TourImage, b: TourImage) =>
  (a.lighting === 'daylight' ? 0 : 1) - (b.lighting === 'daylight' ? 0 : 1)
  || (FREEDOM_RANK[a.freedom] ?? 3) - (FREEDOM_RANK[b.freedom] ?? 3)
  || b.revision - a.revision
  || b.createdAt.localeCompare(a.createdAt);

/**
 * Elige una imagen por ámbito y vista, hasta dos vistas por ámbito, y las ordena: el inmueble completo primero
 * (vuelo y fachadas) y el resto de ámbitos por su nombre. Devuelve también los ámbitos sin ninguna imagen usable.
 */
export function pickTourImages(images: TourImage[], ambients: string[] = [], perAmbient = 2, limit = MAX_TOUR_SHOTS):
  { shots: TourImage[]; missing: string[] } {
  const byAmbient = new Map<string, Map<string, TourImage>>();
  for (const image of images) {
    const views = byAmbient.get(image.ambient) ?? new Map<string, TourImage>();
    const current = views.get(image.view);
    if (!current || better(image, current) < 0) views.set(image.view, image);
    byAmbient.set(image.ambient, views);
  }
  const names = [...byAmbient.keys()].sort((a, b) =>
    (a === WHOLE_PROPERTY ? 0 : 1) - (b === WHOLE_PROPERTY ? 0 : 1) || a.localeCompare(b, 'es'));
  const shots: TourImage[] = [];
  for (const name of names) {
    const views = [...byAmbient.get(name)!.values()].sort((a, b) => viewRank(a.view) - viewRank(b.view) || better(a, b));
    shots.push(...views.slice(0, name === WHOLE_PROPERTY ? Math.max(perAmbient, 4) : perAmbient));
  }
  return { shots: shots.slice(0, limit), missing: ambients.filter((name) => !byAmbient.has(name)) };
}

/** Ordena las imágenes elegidas: inmueble completo primero, luego ámbitos por nombre y, dentro de cada uno, exteriores antes que planos. */
export function orderTourImages(images: TourImage[]): TourImage[] {
  return [...images].sort((a, b) =>
    (a.ambient === WHOLE_PROPERTY ? 0 : 1) - (b.ambient === WHOLE_PROPERTY ? 0 : 1)
    || a.ambient.localeCompare(b.ambient, 'es') || viewRank(a.view) - viewRank(b.view) || better(a, b));
}

export function tourDurationMs(shotCount: number): number {
  return shotCount ? shotCount * TOUR_SHOT_MS - (shotCount - 1) * TOUR_FADE_MS : 0;
}

export interface TourFrame {
  /** Imagen que se ve ahora y, durante el fundido, la anterior que queda debajo. */
  index: number;
  previous: number | null;
  /** Opacidad de la imagen actual sobre la anterior: 1 fuera del fundido. */
  alpha: number;
  /** Encuadre de cada imagen visible, de abajo arriba: zoom y desplazamiento normalizados (-1..1) del movimiento de cámara. */
  layers: { index: number; zoom: number; panX: number; panY: number }[];
}

/** Movimiento lento y determinista: cada imagen se acerca y se desplaza un poco en una dirección que alterna. */
function motion(index: number, progress: number) {
  const eased = progress * progress * (3 - 2 * progress), direction = index % 2 === 0 ? 1 : -1;
  return { zoom: 1 + .09 * eased, panX: direction * (.5 - eased) * .8, panY: (index % 3 - 1) * (.5 - eased) * .4 };
}

/** Qué se ve en un instante del montaje; el mismo instante da siempre el mismo fotograma. */
export function tourFrameAt(shotCount: number, timeMs: number): TourFrame {
  if (!shotCount) throw new Error('El montaje necesita al menos una imagen');
  const step = TOUR_SHOT_MS - TOUR_FADE_MS;
  const time = Math.max(0, Math.min(timeMs, tourDurationMs(shotCount)));
  // La toma i empieza en i·step y dura TOUR_SHOT_MS; durante sus primeros TOUR_FADE_MS aparece sobre la anterior.
  const index = Math.min(shotCount - 1, Math.floor(time / step));
  const local = time - index * step;
  const layers = [{ index, ...motion(index, Math.min(1, local / TOUR_SHOT_MS)) }];
  if (index === 0 || local >= TOUR_FADE_MS) return { index, previous: null, alpha: 1, layers };
  const previous = index - 1;
  layers.unshift({ index: previous, ...motion(previous, Math.min(1, (local + step) / TOUR_SHOT_MS)) });
  return { index, previous, alpha: local / TOUR_FADE_MS, layers };
}
