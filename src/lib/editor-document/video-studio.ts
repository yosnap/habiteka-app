import type { EditorDocument } from './schema';
import { nativeVideoDurationIssue, nativeVideoDurationMs, nativeVideoNeedsRoute, type NativeVideoMode } from './native-video';
import { promotionVideoIssue } from './promotion-video';
import { buildWalkthrough } from './walkthrough-geometry';
import type { ConstructionTimingOptions } from './construction-timing';

export const VIDEO_GOALS = [
  { id: 'construction', title: 'Construcción', description: 'Desde vacío hasta el edificio terminado.', mode: 'construction' },
  { id: 'advertising', title: 'Publicidad', description: 'Presenta el diseño y su entorno.', mode: 'promotion' },
  { id: 'visit', title: 'Primera persona', description: 'Toma interior desde un diseño aceptado.', mode: 'walkthrough' },
  { id: 'combined', title: 'Construcción + visita', description: 'Pendiente: obra e interiores del diseño.', mode: 'showcase' },
] as const;
export type VideoGoal = typeof VIDEO_GOALS[number]['id'];

/** El usuario ve el mismo motivo que impediría grabar; ninguna ruta es necesaria para obra sola. */
export function videoStudioReadiness(doc: EditorDocument, mode: NativeVideoMode, routeId: string | null, options: ConstructionTimingOptions = {}) {
  if (!doc.vertices.length) return { issue: 'Dibuja el edificio antes de crear un vídeo.', durationMs: 0 };
  if (mode === 'promotion') return { issue: promotionVideoIssue(doc), durationMs: nativeVideoDurationMs(0, mode) };
  if (!nativeVideoNeedsRoute(mode)) return { issue: null, durationMs: nativeVideoDurationMs(0, mode, options) };
  const route = doc.walkthroughs?.find(item => item.id === routeId);
  if (!route) return { issue: 'Prepara un recorrido por las estancias que quieres visitar.', durationMs: 0 };
  try {
    const compiled = buildWalkthrough(doc, route);
    const issue = compiled.invalidSegments.length
      ? `El recorrido tiene ${compiled.invalidSegments.length} tramos bloqueados. Ajusta los puntos o despeja el paso.`
      : nativeVideoDurationIssue(compiled.durationMs, mode, options);
    return { issue, durationMs: nativeVideoDurationMs(compiled.durationMs, mode, options) };
  } catch (error) { return { issue: error instanceof Error ? error.message : 'Revisa el recorrido.', durationMs: 0 }; }
}
