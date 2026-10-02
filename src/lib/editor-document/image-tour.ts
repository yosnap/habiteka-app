/** Imagen generada disponible para el montaje, con lo justo para decidir si entra y en qué orden. */
export interface TourImage {
  id: string;
  ambient: string;
  ambientId?: string;
  /** Zonas cubiertas por esta estancia; su nombre visible puede ser diferente. */
  coveredAmbients?: string[];
  view: string;
  lighting: string;
  freedom: string;
  redesignFixed?: boolean;
  redesignInterior?: boolean;
  revision: number;
  createdAt: string;
  url: string;
}

export const TOUR_SHOT_MS = 3200;
export const TOUR_FADE_MS = 800;
export const MAX_TOUR_SHOTS = 24;
/** Ámbito de las imágenes que abarcan todo el inmueble; abren el montaje. */
export const WHOLE_PROPERTY = 'Inmueble completo';

export function missingTourAmbients(shots: TourImage[], expected: string[]): string[] {
  const present = new Set(shots.flatMap((shot) => [shot.ambient, ...(shot.coveredAmbients ?? [])]));
  return expected.filter((name) => !present.has(name));
}

/** Dos dormitorios con la misma etiqueta siguen siendo estancias distintas. */
export const tourAmbientKey = (shot: TourImage): string => shot.ambientId ?? shot.ambient;

// Exteriores y vuelos primero; después las vistas de estudio de cada ambiente.
const VIEW_ORDER = ['exterior', 'drone', 'front', 'back', 'left', 'right', 'isometric', 'top', 'custom'];
const viewRank = (view: string) => { const index = VIEW_ORDER.indexOf(view); return index === -1 ? VIEW_ORDER.length : index; };
// Entre varias imágenes equivalentes gana la de día, después la más fiel al plano y la más reciente.
const FREEDOM_RANK: Record<string, number> = { strict: 0, controlled: 1, free: 2 };
const better = (a: TourImage, b: TourImage, valid?: ReadonlySet<number> | null) =>
  (valid ? (valid.has(a.revision) ? 0 : 1) - (valid.has(b.revision) ? 0 : 1) : 0)
  || (a.lighting === 'daylight' ? 0 : 1) - (b.lighting === 'daylight' ? 0 : 1)
  || (FREEDOM_RANK[a.freedom] ?? 3) - (FREEDOM_RANK[b.freedom] ?? 3)
  || b.revision - a.revision
  || b.createdAt.localeCompare(a.createdAt);

/**
 * Elige una imagen por ámbito y vista, hasta dos vistas por ámbito, y las ordena: el inmueble completo primero
 * (vuelo y fachadas) y el resto de ámbitos por su nombre. Devuelve también los ámbitos sin ninguna imagen usable.
 */
export function pickTourImages(images: TourImage[], ambients: string[] = [], perAmbient = 2, limit = MAX_TOUR_SHOTS, valid?: ReadonlySet<number> | null):
  { shots: TourImage[]; missing: string[] } {
  const byAmbient = new Map<string, Map<string, TourImage>>();
  for (const image of images) {
    if (valid && !valid.has(image.revision)) continue;
    const key = tourAmbientKey(image);
    const views = byAmbient.get(key) ?? new Map<string, TourImage>();
    const current = views.get(image.view);
    if (!current || better(image, current, valid) < 0) views.set(image.view, image);
    byAmbient.set(key, views);
  }
  const names = [...byAmbient.keys()].sort((a, b) => {
    const nameA = byAmbient.get(a)!.values().next().value!.ambient;
    const nameB = byAmbient.get(b)!.values().next().value!.ambient;
    return (nameA === WHOLE_PROPERTY ? 0 : 1) - (nameB === WHOLE_PROPERTY ? 0 : 1)
      || nameA.localeCompare(nameB, 'es') || a.localeCompare(b);
  });
  const shots: TourImage[] = [];
  for (const name of names) {
    const views = [...byAmbient.get(name)!.values()].sort((a, b) => viewRank(a.view) - viewRank(b.view) || better(a, b, valid));
    shots.push(...views.slice(0, views[0]?.ambient === WHOLE_PROPERTY ? Math.max(perAmbient, 4) : perAmbient));
  }
  const selected = shots.slice(0, limit);
  return { shots: selected, missing: missingTourAmbients(selected, ambients) };
}

/** Ordena las imágenes elegidas: inmueble completo primero, luego ámbitos por nombre y, dentro de cada uno, exteriores antes que planos. */
export function orderTourImages(images: TourImage[]): TourImage[] {
  return [...images].sort((a, b) =>
    (a.ambient === WHOLE_PROPERTY ? 0 : 1) - (b.ambient === WHOLE_PROPERTY ? 0 : 1)
    || a.ambient.localeCompare(b.ambient, 'es') || tourAmbientKey(a).localeCompare(tourAmbientKey(b))
    || viewRank(a.view) - viewRank(b.view) || better(a, b));
}

export interface HomogeneityIssue {
  code: 'revision' | 'lighting' | 'freedom' | 'redesign' | 'missing';
  message: string;
  imageIds: string[];
}

/**
 * Comprueba que las imágenes elegidas forman un conjunto coherente antes de animarlas: todas del diseño aprobado
 * (su revisión o una con el mismo contenido), con la misma luz y el mismo nivel de fidelidad, y sin ámbitos vacíos.
 * Un vídeo con IA entre imágenes distintas mezclaría estancias, acabados o muebles que no son los mismos.
 */
/** `valid` en null significa que no hay diseño aprobado: no se comprueba la procedencia. */
export function assessTourHomogeneity(shots: TourImage[], valid: ReadonlySet<number> | null, missing: string[] = []): { ok: boolean; issues: HomogeneityIssue[] } {
  const issues: HomogeneityIssue[] = [];
  const outdated = valid ? shots.filter((shot) => !valid.has(shot.revision)) : [];
  if (outdated.length) issues.push({ code: 'revision', imageIds: outdated.map((shot) => shot.id),
    message: `${outdated.length} imagen(es) no corresponden al diseño aprobado (revisiones ${[...new Set(outdated.map((shot) => shot.revision))].sort((a, b) => a - b).join(', ')}).` });
  // Se señalan como discordantes las imágenes que no comparten el valor mayoritario.
  const minority = (value: (shot: TourImage) => string) => {
    const counts = new Map<string, number>();
    for (const shot of shots) counts.set(value(shot), (counts.get(value(shot)) ?? 0) + 1);
    const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { values: [...counts.keys()], ids: shots.filter((shot) => value(shot) !== majority).map((shot) => shot.id) };
  };
  const lighting = minority((shot) => shot.lighting);
  if (lighting.values.length > 1) issues.push({ code: 'lighting', imageIds: lighting.ids,
    message: `Hay luces mezcladas (${lighting.values.join(', ')}); usa una sola.` });
  const freedom = minority((shot) => shot.freedom);
  if (freedom.values.length > 1) issues.push({ code: 'freedom', imageIds: freedom.ids,
    message: `Las imágenes se generaron con distinta libertad (${freedom.values.join(', ')}); las que añaden objetos no coinciden con el plano.` });
  const redesign = minority((shot) => shot.redesignFixed === true ? 'rediseño' : 'fijos conservados');
  if (redesign.values.length > 1) issues.push({ code: 'redesign', imageIds: redesign.ids,
    message: 'Hay imágenes con y sin permiso de rediseño de fijos; elige un único criterio para todo el vídeo.' });
  const interior = minority((shot) => shot.redesignInterior ? 'interiorismo rediseñado' : 'interiorismo conservado');
  if (interior.values.length > 1) issues.push({ code: 'redesign', imageIds: interior.ids,
    message: 'Hay imágenes de interiorismo conservado y rediseñado; utiliza el mismo diseño para todo el vídeo.' });
  if (missing.length) issues.push({ code: 'missing', imageIds: [], message: `La selección no incluye imágenes de: ${missing.join(', ')}.` });
  return { ok: !issues.length, issues };
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
