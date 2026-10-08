import type { Opening } from '@/lib/editor-document/schema';
import type { OpeningType } from '@/lib/editor-document/opening-types';
import { FRAME_FINISH_APPEARANCE, LEAF_FINISH_APPEARANCE, type OpeningLook } from '@/lib/editor-document/opening-look';
import type { SceneBox } from './types';
import { WINDOW_GLASS_COLOR, WINDOW_SEAL_COLOR } from './window-appearance';

/**
 * Tono de cada pieza de una puerta o ventana: la hoja con su acabado (y en sombra, para ranuras y biseles), el marco,
 * el vidrio, la junta y los herrajes (acero satinado, hierro negro de granero y la lente oscura de la mirilla).
 */
export type PartTone = 'leaf' | 'shade' | 'frame' | 'glass' | 'seal' | 'steel' | 'iron' | 'dark';
export type PartStyle = Pick<SceneBox, 'color'> & Partial<Pick<SceneBox, 'materialId' | 'appearance'>>;

const STEEL = '#b9bdc0', IRON = '#2a2b2d', DARK = '#16181a';
const DEFAULT_LEAF = '#bb956c', DEFAULT_FRAME = '#f4f1e9';

/** El mismo tono algo más oscuro: el fondo de una ranura o el bisel de un cuarterón queda en sombra. */
export function shadeColor(hex: string, factor = .6): string {
  const value = Number.parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  if (!Number.isFinite(value)) return hex;
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * factor).toString(16).padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

function leafStyle(opening: Opening, look: OpeningLook): PartStyle {
  if (!look.finish) return { color: opening.colors?.leaf ?? DEFAULT_LEAF };
  const { color, materialId } = LEAF_FINISH_APPEARANCE[look.finish];
  return materialId ? { color, materialId } : { color };
}

/** Marco de puerta a juego con su hoja si se eligió acabado; el de ventanas y correderas de vidrio, con el suyo. */
function frameStyle(opening: Opening, type: OpeningType, look: OpeningLook): PartStyle {
  if (type.kind === 'puerta' && type.operation !== 'corredera-marco') return look.finish ? leafStyle(opening, look) : { color: opening.colors?.frame ?? DEFAULT_FRAME };
  if (!look.frameFinish) return { color: opening.colors?.frame ?? DEFAULT_FRAME };
  const { color, materialId, metal } = FRAME_FINISH_APPEARANCE[look.frameFinish];
  return { color, ...(materialId ? { materialId } : {}), ...(metal ? { appearance: 'powder-coated-metal' as const } : {}) };
}

/**
 * Color, textura y brillo de una pieza. Sin tono explícito decide su rol, con los mismos colores de siempre: así un
 * documento sin acabado elegido se ve exactamente igual que antes.
 */
export function openingPartStyle(opening: Opening, type: OpeningType, look: OpeningLook, role: SceneBox['role'], tone?: PartTone): PartStyle {
  switch (tone ?? (role === 'glass' ? 'glass' : role === 'seal' ? 'seal' : role === 'leaf' ? 'leaf' : 'frame')) {
    case 'glass': return { color: WINDOW_GLASS_COLOR };
    case 'seal': return { color: WINDOW_SEAL_COLOR };
    case 'steel': return { color: STEEL, appearance: 'powder-coated-metal' };
    case 'iron': return { color: IRON, appearance: 'powder-coated-metal' };
    case 'dark': return { color: DARK };
    case 'leaf': return leafStyle(opening, look);
    case 'shade': {
      const base = leafStyle(opening, look);
      return { ...base, color: shadeColor(base.color, base.materialId ? .55 : .62) };
    }
    default: return frameStyle(opening, type, look);
  }
}
