import type { RenderView } from './render-view';

/** La ocultación de estudio prevalece sobre el inventario y sobre otras imágenes de referencia. */
export function renderViewVisibilityRule(view: RenderView): string {
  return [
    ...(view.ceilingView === 'hidden' ? ['VISIBILIDAD DE ESTUDIO: techo, falso techo y tejado ocultos para mostrar el interior. No los reconstruyas ni los añadas desde otra referencia; conserva todos los muros visibles.'] : []),
    ...(view.cutaway ? ['CORTE DE FACHADA: oculta SOLO los muros exteriores del lado de cámara y sus ventanas, puertas, cortinas, persianas y estores. Conserva TODOS los tabiques interiores, separaciones entre habitaciones y muros del fondo: no elimines paredes para ampliar la vista. No cierres el corte ni añadas elementos que vuelvan a tapar ese frente.'] : []),
    ...(view.cutawayWallIds?.length ? [`Únicos muros ocultos en esta cámara: ${JSON.stringify(view.cutawayWallIds)}. Todos los demás muros mantienen su forma y posición.`] : []),
    ...(view.cutawayObjectIds?.length ? [`Objetos ocultos solo en esta cámara: ${JSON.stringify(view.cutawayObjectIds)}. Siguen en el diseño; no los muestres ni los recoloques.`] : []),
  ].join(' ');
}
