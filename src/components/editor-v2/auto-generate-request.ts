/**
 * Apertura del editor ya preparado para generar, pedida por la URL.
 *
 * El asistente termina la ruta del plano mandando al usuario aquí con
 * `?generar=interiores&estilo=…`: el editor abre el diálogo de generación con
 * las vistas interiores por estancia y el estilo ya elegidos, para que no tenga
 * que repetir en el editor lo que acaba de decidir en el asistente.
 *
 * Es solo una sugerencia de arranque: no genera nada por sí sola ni salta
 * ninguna puerta; el usuario sigue confirmando en el diálogo.
 */
import { isValidEstilo } from '@/lib/design-options';
import type { Estilo } from '@/lib/contracts';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';

/** Valor de `?generar=` que pide las vistas interiores por estancia. */
export const INTERIORS_REQUEST = 'interiores';

export interface AutoGenerateRequest {
  /** Marca de salida: vistas interiores de todas las estancias habitables. */
  interiorRooms: boolean;
  estilo?: Estilo;
  continuation?: { batchId: string; options: RenderDesignOptions; completedViews: string[] };
  error?: string;
}

export function continueRenderBatchHref(projectId: string, zoneId: string | null, batchId: string): string {
  const params = new URLSearchParams({ continuarTanda: batchId });
  if (zoneId) params.set('zona', zoneId);
  return `/projects/${projectId}?${params.toString()}`;
}

/** Enlace al editor con el diálogo de vistas interiores preparado. */
export function interiorsEditorHref(
  projectId: string,
  zoneId: string | null,
  estilo?: Estilo,
): string {
  const params = new URLSearchParams();
  if (zoneId) params.set('zona', zoneId);
  params.set('generar', INTERIORS_REQUEST);
  if (estilo) params.set('estilo', estilo);
  return `/projects/${projectId}?${params.toString()}`;
}

/** Lee los parámetros de la URL; cualquier valor desconocido no pide nada. */
export function parseAutoGenerate(params: {
  generar?: string;
  estilo?: string;
}): AutoGenerateRequest | null {
  if (params.generar !== INTERIORS_REQUEST) return null;
  return {
    interiorRooms: true,
    ...(isValidEstilo(params.estilo) ? { estilo: params.estilo } : {}),
  };
}
