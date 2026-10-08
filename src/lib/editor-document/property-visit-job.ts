import type { LightingPreset } from '@/lib/lighting-preset';
import type { PropertyVisitFrame, PropertyVisitPlan } from './property-visit-types';
import { sameCameraPose } from '@/lib/contracts/storyboard-image';

export const PROPERTY_VISIT_MODEL = 'minimax-h3/image-to-video';
export const PROPERTY_VISIT_COMPACT_MODEL = 'hailuo/02-image-to-video-standard';
export type PropertyVisitModel = typeof PROPERTY_VISIT_MODEL | typeof PROPERTY_VISIT_COMPACT_MODEL;
export type VisitTaskState = 'pending' | 'submitting' | 'generating' | 'review' | 'accepted' | 'rejected' | 'unknown' | 'failed';
export interface VisitImage { id: string; frame: PropertyVisitFrame; state: VisitTaskState; sourceId?: string; error?: string; previousSourceIds?: string[] }
export interface VisitSegment {
  id: string; from: string; to: string; label: string; seconds: number;
  state: VisitTaskState; taskId?: string; assetKey?: string; error?: string;
  reviewedAt?: string; reviewedBy?: string;
  sourceVersions?: { id: string; version: number }[];
  attempts?: { taskId?: string; assetKey?: string; state: VisitTaskState }[];
  route?: PropertyVisitFrame[];
}
export interface PropertyVisitJob {
  type: 'video'; mode: 'property-visit-ai'; title: string;
  approvalId: string; approvedRevision: number; approvedFingerprint: string;
  lighting: LightingPreset; openDoors: boolean; anchorIds: string[];
  plan: PropertyVisitPlan; images: VisitImage[]; segments: VisitSegment[];
  resolution: '768P' | '2K'; durationMs: number;
  imagePriceUsd: number; imageModel: string; createdAt: string;
  /** Ausente en los paseos antiguos: conservan H3 y su tarifa original. */
  videoModel?: PropertyVisitModel;
  assetKey?: string; finalReviewedAt?: string; finalReviewedBy?: string;
}

/** Un piloto solo fija sus extremos; las imágenes de otros tramos pueden seguir preparándose. */
export function propertyVisitImageLocked(job: PropertyVisitJob, imageId: string) {
  return job.segments.some(segment => (segment.from === imageId || segment.to === imageId)
    && (segment.state !== 'pending' || Boolean(segment.attempts?.length)));
}

/** Cada unión comparte exactamente la misma imagen. Las pausas reutilizan su cámara, sin otro render. */
export function propertyVisitSequence(plan: PropertyVisitPlan) {
  if (!plan.complete || plan.frames.length < 2) throw new Error('Falta cubrir todo el inmueble antes de guardar el paseo.');
  const images: VisitImage[] = [], segments: VisitSegment[] = [];
  let previous: VisitImage | undefined;
  for (const frame of plan.frames) {
    let image = images.find(item => sameCameraPose(item.frame.camera, frame.camera));
    if (!image) { image = { id: `image-${images.length + 1}`, frame, state: 'pending' }; images.push(image); }
    if (previous) {
      if (!Number.isInteger(frame.secondsFromPrevious) || frame.secondsFromPrevious < 4 || frame.secondsFromPrevious > 15)
        throw new Error('Un tramo excede la duración admitida. Recalcula el recorrido.');
      const path = plan.pathFrames;
      const previousFrame = plan.frames[segments.length]!;
      const route = path?.slice(path.findIndex(item => item.id === previousFrame.id), path.findIndex(item => item.id === frame.id) + 1);
      segments.push({ id: `segment-${segments.length + 1}`, from: previous.id, to: image.id,
        label: frame.label, seconds: frame.secondsFromPrevious, state: 'pending', ...(route ? { route } : {}) });
    }
    previous = image;
  }
  return { images, segments };
}

/** Tarifas KIE verificadas el 07/10/2026: /hailuo-api (Standard) y /minimax-h3. */
export function propertyVisitSegmentPrice(seconds: number, resolution: '768P' | '2K', model: PropertyVisitModel = PROPERTY_VISIT_MODEL) {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Duración de vídeo inválida.');
  if (model === PROPERTY_VISIT_COMPACT_MODEL) {
    if (resolution !== '768P' || ![6, 10].includes(seconds)) throw new Error('Hailuo 02 requiere tramos de 6 o 10 segundos a 768p.');
    return Math.round(seconds * .025 * 10000) / 10000;
  }
  if (model !== PROPERTY_VISIT_MODEL) throw new Error('Modelo de vídeo no admitido.');
  return Math.round(seconds * (resolution === '2K' ? .065 : .04) * 10000) / 10000;
}

export function propertyVisitQuote(job: Pick<PropertyVisitJob, 'images' | 'segments' | 'imagePriceUsd' | 'resolution' | 'videoModel'>) {
  return { images: job.images.filter(image => image.state === 'pending').length,
    imageUsd: Number((job.images.filter(image => image.state === 'pending').length * job.imagePriceUsd).toFixed(4)),
    videoUsd: Number(job.segments.filter(segment => segment.state === 'pending')
      .reduce((total, segment) => total + propertyVisitSegmentPrice(segment.seconds, job.resolution, job.videoModel), 0).toFixed(4)) };
}

export function propertyVisitSegmentPrompt(job: PropertyVisitJob, segment: VisitSegment) {
  if (job.videoModel === PROPERTY_VISIT_COMPACT_MODEL) return compactSegmentPrompt(segment);
  const a = job.images.find(image => image.id === segment.from)!.frame.camera;
  const b = job.images.find(image => image.id === segment.to)!.frame.camera;
  return `One uninterrupted hyperrealistic first-person property viewing shot, ${segment.seconds} seconds. ` +
    `Start exactly on the supplied first frame and end exactly on the supplied last frame. ` +
    `These are user-accepted views of ONE property: preserve architecture, doors, windows, furniture, materials, colors and lighting throughout. ` +
    `Camera starts at ${JSON.stringify(a.position)} metres looking at ${JSON.stringify(a.focus)} and ends at ${JSON.stringify(b.position)} looking at ${JSON.stringify(b.focus)}. ` +
    `Coordinates specify motion only; appearance comes exclusively from the accepted frames. ` +
    (segment.from === segment.to ? 'Remain at this viewpoint and observe details with an almost still handheld camera. ' :
      'Walk or turn slowly and naturally at eye level. Keep verticals upright and the field of view constant. ') +
    'Use existing open doorways. Respect floor steps. No teleportation, wall crossing, morphing, furniture substitutions, dissolves, cuts, aerial views or new rooms. No people, text, narration or music. Maintain the final view for a smooth shared boundary with the next shot.';
}

function compactSegmentPrompt(segment: VisitSegment) {
  // Todos los cambios de posición se conservan: nunca simplificar cortando una esquina o una pared.
  const points = segment.route?.map(frame => frame.camera.position.map(value => Number(value.toFixed(2))))
    .filter((point, index, all) => index === 0 || JSON.stringify(point) !== JSON.stringify(all[index - 1]));
  const prompt = `Hyperrealistic first-person property tour, ${segment.seconds}s, one continuous eye-level shot. ` +
    'Match the supplied accepted first and last images exactly. Preserve the same furniture, materials, colors, lighting, walls, doors, windows and roof throughout. ' +
    `Follow these ordered camera positions in metres (geometry only): ${JSON.stringify(points ?? [])}. ` +
    'Move briskly and smoothly through the existing open doors, show each space along the route, then match the final framing. Keep verticals upright. ' +
    'No wall crossing, teleportation, cuts, dissolves, morphing, new rooms, substituted furniture, people or text. The images define the appearance; coordinates only guide movement.';
  if (prompt.length > 1500) throw new Error('El trazado del tramo supera el guion admitido por Hailuo. Revisa la preparación sin generar.');
  return prompt;
}
