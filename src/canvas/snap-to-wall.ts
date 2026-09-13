/**
 * Enganche de objetos a muros (puertas, ventanas, elementos de superficie).
 * Lógica PURA y compartida: la usan la creación por drop en el stage y el
 * re-enganche al terminar de arrastrar (un hijo de muro nunca debe quedar
 * flotando ni desalineado del eje de su muro).
 */

export interface WallLike {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface WallSnapResult {
  x: number;
  y: number;
  height: number;
  rotation: number;
  wallId: string;
}

/**
 * Busca el muro más cercano al punto `worldPt` y, si está dentro del umbral,
 * devuelve la posición/rotación del objeto hijo alineado sobre ese muro.
 * El grosor del objeto se hereda del muro para sellar el hueco visualmente.
 */
export function snapToWall(
  worldPt: { x: number; y: number },
  walls: WallLike[],
  objWidth: number,
  /** Si true, ignora el umbral de distancia y siempre pega al muro más cercano
   *  (para wall-surface: enchufes, cuadros, etc. que DEBEN estar en un muro). */
  force = false,
): WallSnapResult | null {
  const SNAP_PX = force ? Infinity : Math.max(60, (walls[0]?.height ?? 12) * 4);
  let bestDist = SNAP_PX;
  let best: WallSnapResult | null = null;

  for (const wall of walls) {
    const θ = (wall.rotation * Math.PI) / 180;
    const cosθ = Math.cos(θ),
      sinθ = Math.sin(θ);
    const dx = worldPt.x - wall.x,
      dy = worldPt.y - wall.y;
    const localX = dx * cosθ + dy * sinθ;
    const localY = -dx * sinθ + dy * cosθ;
    const perpDist = Math.abs(localY - wall.height / 2);
    if (!force && perpDist >= SNAP_PX) continue;
    if (localX < -wall.height || localX > wall.width + wall.height) continue;
    if (perpDist < bestDist) {
      bestDist = perpDist;
      const clamped = Math.max(objWidth / 2, Math.min(wall.width - objWidth / 2, localX));
      // Centro del objeto pegado al eje del muro (local_y = wall.height/2).
      const cx = wall.x + clamped * cosθ + (wall.height / 2) * -sinθ;
      const cy = wall.y + clamped * sinθ + (wall.height / 2) * cosθ;
      const H = wall.height;
      best = {
        x: cx - (objWidth / 2) * cosθ + (H / 2) * sinθ,
        y: cy - (objWidth / 2) * sinθ - (H / 2) * cosθ,
        height: H,
        rotation: wall.rotation,
        wallId: wall.id,
      };
    }
  }
  return best;
}
