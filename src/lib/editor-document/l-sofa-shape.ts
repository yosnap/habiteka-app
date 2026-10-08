/**
 * Forma en planta de los sofás en L del catálogo, en fracciones de su ancho y fondo: el tramo largo apoyado en el muro
 * (y local 0) y el tramo corto a la derecha. El hueco de la L queda libre para la mesa de centro y la alfombra; tratarlos
 * como un rectángulo macizo de 2,8 × 2,2 m echaba la mesa de centro fuera y no dejaba sitio al mueble de TV.
 */
const L_SHAPES: Readonly<Record<string, { seat: number; arm: number }>> = {
  'sofa-corner': { seat: .43, arm: .66 },
  'sofa-chaise': { seat: .6, arm: .66 },
};

/** Rectángulos locales (x, y, ancho, fondo en mm) que ocupa la pieza en planta. */
export function planParts(profile: string | undefined, widthMm: number, depthMm: number): { x: number; y: number; widthMm: number; depthMm: number }[] {
  const shape = profile ? L_SHAPES[profile] : undefined;
  if (!shape) return [{ x: 0, y: 0, widthMm, depthMm }];
  return [{ x: 0, y: 0, widthMm, depthMm: depthMm * shape.seat },
    { x: widthMm * shape.arm, y: depthMm * shape.seat, widthMm: widthMm * (1 - shape.arm), depthMm: depthMm * (1 - shape.seat) }];
}

/** Hueco frente al asiento: dónde empieza (fondo del tramo largo) y qué ancho tiene. Un sofá recto lo tiene completo. */
export function seatOpening(profile: string | undefined, widthMm: number, depthMm: number): { depthMm: number; widthMm: number } {
  const shape = profile ? L_SHAPES[profile] : undefined;
  return shape ? { depthMm: depthMm * shape.seat, widthMm: widthMm * shape.arm } : { depthMm, widthMm };
}
