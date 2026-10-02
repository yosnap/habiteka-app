import type { RenderDesignOptions } from './render-design-options';

/** El permiso de cambiar fijos y la intención estética son distintos de cambiar la geometría. */
export function requestedRenderRedesign(options: Pick<RenderDesignOptions, 'redesignFixed'> & Partial<Pick<RenderDesignOptions, 'redesignInterior'>>, objective: string, instruction: string): boolean {
  return Boolean(options.redesignInterior || options.redesignFixed || /\b(rediseñ\w*|redisen\w*|redesign\w*|remodel\w*)/i.test(`${objective} ${instruction}`));
}

export const RENDER_REDESIGN_RULE = 'REDISEÑO SOLICITADO: propón un interiorismo nuevo, con cambios reconocibles en formas, estilo, acabados y mobiliario móvil dentro del ámbito permitido. No entregues una copia de los muebles de la captura con mejor textura o iluminación. La captura fija la geometría, los pasos y el uso; los fijos solo pueden sustituirse cuando existe permiso explícito. Si hay una vista aceptada del lote, conserva ese NUEVO diseño en las siguientes vistas.';
