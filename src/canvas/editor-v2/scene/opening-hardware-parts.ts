import type { LeafPanel } from '@/lib/editor-document/opening-leaves';
import type { OpeningLook } from '@/lib/editor-document/opening-look';
import type { OpeningType } from '@/lib/editor-document/opening-types';
import type { DoorHandle } from '@/lib/editor-document/opening-look-options';
import type { LeafPart } from './opening-leaf-parts';
import type { LeafSpan } from './opening-leaf-designs';
import type { PartTone } from './opening-part-style';

/** Altura habitual de la manilla y del pomo sobre el canto inferior de la hoja. */
const HANDLE_HEIGHT_MM = 1000;
const PEEPHOLE_HEIGHT_MM = 1500;

const piece = (along: number, y: number, length: number, height: number, thickness: number, across: number, tone: PartTone,
  shape?: LeafPart['shape']): LeafPart => ({ role: 'frame', along, y, length, height, thickness, across, tone, ...(shape ? { shape } : {}) });

/** Un tirador de los que se eligen, en la cara `face` (normal de la hoja), con su canto de agarre en `along`. */
function handleOn(handle: DoorHandle, face: 1 | -1, along: number, pull: 1 | -1, span: LeafSpan, thickness: number, tone: PartTone): LeafPart[] {
  const surface = face * thickness / 2, height = span.top - span.bottom;
  const y = span.bottom + Math.min(HANDLE_HEIGHT_MM, height * .5);
  switch (handle) {
    case 'manilla': return [
      piece(along, y, 52, 52, 10, surface + face * 5, tone, 'rounded-box'),
      piece(along, y, 16, 16, 34, surface + face * 26, tone),
      piece(along - pull * 56, y, 128, 16, 16, surface + face * 43, tone, 'rounded-box'),
      // Bocallave bajo la manilla.
      piece(along, y - 150, 34, 46, 8, surface + face * 4, tone, 'rounded-box'),
    ];
    case 'pomo': return [
      piece(along, y, 58, 58, 10, surface + face * 5, tone, 'rounded-box'),
      piece(along, y, 64, 64, 52, surface + face * 34, tone, 'ellipsoid'),
    ];
    case 'tirador': {
      const length = Math.min(1200, height * .5), center = span.bottom + Math.min(1050, height * .5);
      return [
        piece(along, center, 26, length, 26, surface + face * 48, tone, 'cylinder'),
        ...[-1, 1].map((end) => piece(along, center + end * (length / 2 - 70), 18, 18, 40, surface + face * 20, tone)),
      ];
    }
    default: return [];
  }
}

/**
 * Herrajes de una hoja de puerta, en sus coordenadas: el tirador elegido en las dos caras (en una corredera vista, solo
 * en la que da a la estancia); en una puerta de entrada, el pomo centrado o el tirador largo por fuera, la manilla por
 * dentro, el escudo de la cerradura y la mirilla; los pernios de la de vidrio y la placa de protección de la de vaivén.
 * Los tipos históricos sin aspecto elegido no llevan herrajes, como siempre.
 */
export function leafHardware(panel: LeafPanel, type: OpeningType, look: OpeningLook, span: LeafSpan): LeafPart[] {
  if (!look.detailed || type.kind !== 'puerta') return [];
  const thickness = panel.thicknessMm, half = panel.lengthMm / 2, parts: LeafPart[] = [];
  const tone: PartTone = type.barn ? 'iron' : 'steel';
  if (type.doubleActing) for (const face of [1, -1] as const)
    parts.push(piece(0, span.bottom + 125, panel.lengthMm - 40, 250, 2, face * (thickness / 2 + 1), 'steel'));
  if (type.frameless) for (const y of [span.bottom + 60, span.top - 60])
    parts.push(piece(-half + 75, y, 150, 70, thickness + 16, 0, 'steel'));
  const { pull, face: swingFace = 1 } = panel;
  if (!pull) return parts;
  const edge = pull * (half - (look.handle === 'tirador' ? 85 : 65));
  const entrance = type.entrance && !!panel.hinge, exterior = (-swingFace) as 1 | -1;
  const faces: (1 | -1)[] = type.operation === 'corredera' ? [swingFace] : [1, -1];
  for (const face of faces) {
    if (entrance && face === exterior && look.handle === 'pomo')
      parts.push(...handleOn('pomo', face, 0, pull, { bottom: span.bottom + 50, top: span.top }, thickness, tone),
        piece(edge, span.bottom + Math.min(HANDLE_HEIGHT_MM, (span.top - span.bottom) * .5), 48, 130, 10, face * (thickness / 2 + 5), tone, 'rounded-box'));
    else if (entrance && face !== exterior && look.handle !== 'ninguno')
      parts.push(...handleOn('manilla', face, pull * (half - 65), pull, span, thickness, tone));
    else parts.push(...handleOn(look.handle, face, edge, pull, span, thickness, tone));
  }
  if (entrance && span.top - span.bottom > PEEPHOLE_HEIGHT_MM + 100) parts.push(
    piece(0, span.bottom + PEEPHOLE_HEIGHT_MM, 30, 30, thickness + 12, 0, 'steel', 'ellipsoid'),
    piece(0, span.bottom + PEEPHOLE_HEIGHT_MM, 15, 15, thickness + 16, 0, 'dark', 'ellipsoid'));
  return parts;
}

/** Manilla de ventana oscilobatiente: roseta y palanca hacia abajo en el canto libre, por la cara interior. */
export function windowHandle(panel: LeafPanel, type: OpeningType, span: LeafSpan): LeafPart[] {
  if (!type.tilt || !panel.pull) return [];
  const face = panel.face ?? 1, surface = face * panel.thicknessMm / 2, along = panel.pull * (panel.lengthMm / 2 - 28);
  const y = (span.bottom + span.top) / 2;
  return [piece(along, y, 30, 72, 10, surface + face * 5, 'steel', 'rounded-box'),
    piece(along, y - 48, 18, 110, 16, surface + face * 22, 'steel', 'rounded-box')];
}
