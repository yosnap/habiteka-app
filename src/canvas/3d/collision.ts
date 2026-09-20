/**
 * Colisión suave entre muebles del suelo (F2).
 *
 * No usa física completa. Solo aplica resolución AABB al soltar un mueble:
 *   1. Calcula la superposición con cada vecino.
 *   2. Empuja en la dirección de penetración mínima.
 *   3. Itera hasta no haber solapamiento (máx. 3 veces).
 *
 * Los AABBs de los vecinos ya incluyen su rotación (caller los computa como
 * bbox del objeto rotado: hw = |cos|·w/2 + |sin|·d/2, etc.).
 *
 * Lógica pura y testeable, sin dependencias de Three ni React.
 */

/** Caja axis-aligned en el plano XZ (metros). */
export interface FloorAABB {
  id: string;
  /** Centro en X (metros). */
  cx: number;
  /** Centro en Z (metros). */
  cz: number;
  /** Semiancho en X (metros). */
  hw: number;
  /** Semiprofundidad en Z (metros). */
  hd: number;
}

/**
 * Resuelve la posición final de `item` para que no se solape con ninguno de
 * `others` en el plano XZ del suelo.
 *
 * Solo se mueve `item`; los demás se consideran fijos.
 * Devuelve [cx, cz] definitivos (en metros).
 */
export function resolveFloorCollisions(
  item: FloorAABB,
  others: FloorAABB[],
  maxIterations = 3,
): [number, number] {
  let cx = item.cx;
  let cz = item.cz;

  for (let iter = 0; iter < maxIterations; iter++) {
    let anyOverlap = false;

    for (const other of others) {
      if (other.id === item.id) continue;

      const dx = cx - other.cx;
      const dz = cz - other.cz;
      const overlapX = item.hw + other.hw - Math.abs(dx);
      const overlapZ = item.hd + other.hd - Math.abs(dz);

      if (overlapX <= 0 || overlapZ <= 0) continue; // sin solapamiento

      anyOverlap = true;
      // Empujar por el eje de penetración mínima
      if (overlapX <= overlapZ) {
        cx += overlapX * (dx >= 0 ? 1 : -1);
      } else {
        cz += overlapZ * (dz >= 0 ? 1 : -1);
      }
    }

    if (!anyOverlap) break;
  }

  return [cx, cz];
}

/**
 * Construye el AABB en el plano XZ para un objeto con rotación.
 * Para objetos rotados, el AABB es el bbox del rectángulo rotado:
 *   hw = |cos θ|·(w/2) + |sin θ|·(d/2)
 *   hd = |sin θ|·(w/2) + |cos θ|·(d/2)
 */
export function buildFloorAABB(
  id: string,
  cx: number,
  cz: number,
  wM: number,
  dM: number,
  rotationY: number,
): FloorAABB {
  const cosA = Math.abs(Math.cos(rotationY));
  const sinA = Math.abs(Math.sin(rotationY));
  const hw = cosA * (wM / 2) + sinA * (dM / 2);
  const hd = sinA * (wM / 2) + cosA * (dM / 2);
  return { id, cx, cz, hw, hd };
}
