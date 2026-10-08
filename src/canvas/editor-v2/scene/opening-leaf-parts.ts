import type { LeafPanel } from '@/lib/editor-document/opening-leaves';
import type { OpeningType } from '@/lib/editor-document/opening-types';
import type { OpeningLook } from '@/lib/editor-document/opening-look';
import type { SceneBox } from './types';
import type { PartTone } from './opening-part-style';
import { designParts, groovedLeaf, ribbedLeaf } from './opening-leaf-designs';
import { leafHardware, windowHandle } from './opening-hardware-parts';

/**
 * Pieza de una hoja: desplazamiento a lo largo de su eje (`along`) y a través de él (`across`, sobre su normal
 * izquierda) y alturas relativas a la cota de la abertura. `tone` elige su color o acabado; sin él, decide su rol.
 */
export interface LeafPart {
  role: SceneBox['role']; along: number; y: number; length: number; height: number; thickness: number;
  across?: number; tone?: PartTone; shape?: SceneBox['shape'];
}

/** Galería de la corredera vista: tapa la guía por encima de la hoja. */
export const SLIDING_RAIL_MM = 50;
/** La hoja de granero tapa el dintel: sube por encima del hueco hasta las ruedas. */
export const BARN_LEAF_OVERLAP_MM = 60;
/** La seccional, montada por dentro, sobrepasa el dintel. */
export const GARAGE_HEAD_OVERLAP_MM = 40;

/** Alturas de las hojas: las de puerta, del suelo al marco superior; los paños de ventana, entre los marcos. */
export function leafSpan(type: OpeningType, heightMm: number, frameMm: number): { bottom: number; top: number } {
  // Con fijo superior, las hojas acaban bajo el montante.
  if (type.kind === 'ventana') return { bottom: frameMm, top: heightMm - frameMm - (type.transomMm ? type.transomMm + frameMm : 0) };
  if (type.barn) return { bottom: 10, top: heightMm + BARN_LEAF_OVERLAP_MM };
  // La corredera vista cuelga de su guía y no roza el suelo.
  if (type.operation === 'corredera') return { bottom: 10, top: heightMm - SLIDING_RAIL_MM };
  if (type.operation === 'seccional' || type.operation === 'basculante') return { bottom: 0, top: heightMm + GARAGE_HEAD_OVERLAP_MM };
  // La persiana enrollable entra en su cajón, justo sobre el hueco.
  if (type.operation === 'enrollable') return { bottom: 0, top: heightMm };
  return { bottom: 0, top: heightMm - frameMm };
}

/**
 * Piezas de una hoja con su diseño y sus herrajes. Los paños de ventana y las hojas de corredera de vidrio son bastidor
 * y vidrio con el color del marco (aluminio o PVC); las hojas de puerta siguen su diseño (lisa, ranurada, cuarterones…)
 * con el acabado de la hoja. La seccional son paneles ranurados y la de vidrio templado, una luna con sus pernios.
 */
export function leafParts(panel: LeafPanel, type: OpeningType, fullSpan: { bottom: number; top: number }, look: OpeningLook): LeafPart[] {
  const range = panel.heightRange, full = fullSpan.top - fullSpan.bottom;
  const span = range ? { bottom: fullSpan.bottom + full * range[0], top: fullSpan.bottom + full * range[1] } : fullSpan;
  if (span.top - span.bottom < 1) return [];
  const door = type.kind === 'puerta' && type.operation !== 'corredera-marco';
  if (!door) return [...glazedOrSolid(panel, type, span), ...windowHandle(panel, type, span)];
  const hardware = leafHardware(panel, type, look, span);
  if (type.frameless) return [{ role: 'glass', along: 0, y: (span.top + span.bottom) / 2, length: panel.lengthMm,
    height: span.top - span.bottom, thickness: panel.thicknessMm }, ...hardware];
  // Seccional: paneles de unos 53 cm; enrollable: lamas de 9 cm; basculante: chapa nervada en vertical.
  if (type.operation === 'seccional') return [...groovedLeaf(panel.lengthMm, span, panel.thicknessMm, 530, 18), ...hardware];
  if (type.operation === 'enrollable') return groovedLeaf(panel.lengthMm, span, panel.thicknessMm, 90, 8);
  if (type.operation === 'basculante') return ribbedLeaf(panel.lengthMm, span, panel.thicknessMm, 220);
  const leaf = look.design === 'vidrio' ? glazedOrSolid({ ...panel, glazed: true }, type, span)
    : designParts(look.design, panel.lengthMm, span, panel.thicknessMm);
  return [...leaf, ...hardware];
}

/** La hoja histórica: una caja maciza o, si es acristalada, bastidor, zócalo y vidrio. */
function glazedOrSolid(panel: LeafPanel, type: OpeningType, span: { bottom: number; top: number }): LeafPart[] {
  const role: SceneBox['role'] = type.kind === 'puerta' && type.operation !== 'corredera-marco' ? 'leaf' : 'frame';
  const height = span.top - span.bottom, y = (span.top + span.bottom) / 2, thickness = panel.thicknessMm;
  if (!panel.glazed) return [{ role, along: 0, y, length: panel.lengthMm, height, thickness }];
  const stile = Math.min(role === 'leaf' ? 110 : 55, panel.lengthMm / 4, height / 4);
  // La vidriera lleva zócalo macizo, más alto que el travesaño superior.
  const base = role === 'leaf' ? stile * 2 : stile, inner = panel.lengthMm - 2 * stile, glass = height - stile - base;
  return [
    { role, along: -(panel.lengthMm - stile) / 2, y, length: stile, height, thickness },
    { role, along: (panel.lengthMm - stile) / 2, y, length: stile, height, thickness },
    { role, along: 0, y: span.top - stile / 2, length: inner, height: stile, thickness },
    { role, along: 0, y: span.bottom + base / 2, length: inner, height: base, thickness },
    { role: 'glass', along: 0, y: span.bottom + base + glass / 2, length: inner, height: glass, thickness: 8 },
  ];
}
