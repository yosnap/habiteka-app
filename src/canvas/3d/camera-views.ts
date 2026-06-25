/**
 * Posiciones de cámara predefinidas para capturar VISTAS del 3D (puro, sin Three).
 *
 * Dado el "span" de la escena (lado mayor del suelo en metros) y la altura de techo,
 * devuelve la posición de cámara y el punto al que mira para cada ángulo. El componente
 * 3D coloca la cámara con estos valores antes de capturar el canvas. Lógica pura: así los
 * ángulos quedan testeados y consistentes, sin depender del estado de OrbitControls.
 */

/** Ángulos de vista ofrecidos al usuario. */
export type ViewAngle = 'perspectiva' | 'isometrica' | 'cenital';

export interface CameraView {
  /** Posición de la cámara en metros [x, y, z]. */
  position: [number, number, number];
  /** Punto al que mira la cámara [x, y, z] (centro de la sala a media altura). */
  target: [number, number, number];
}

export const VIEW_ANGLES: { id: ViewAngle; label: string }[] = [
  { id: 'perspectiva', label: 'Perspectiva' },
  { id: 'isometrica', label: 'Isométrica' },
  { id: 'cenital', label: 'Cenital' },
];

/**
 * Calcula la cámara para un ángulo dado. `span` = lado mayor del suelo (m); `ceiling` =
 * altura de techo (m). La cámara siempre mira al centro de la sala a media altura.
 */
export function cameraForAngle(angle: ViewAngle, span: number, ceiling: number): CameraView {
  const s = Math.max(span, 4); // un mínimo para salas pequeñas
  const target: [number, number, number] = [0, ceiling / 2, 0];
  switch (angle) {
    case 'perspectiva':
      // Vista a la altura de los ojos, en escorzo (como entrar a la sala).
      return { position: [s * 0.9, ceiling * 0.7, s * 1.1], target };
    case 'isometrica':
      // Vista elevada en ángulo de 45°, todo el volumen visible.
      return { position: [s * 0.9, s * 0.9, s * 0.9], target };
    case 'cenital':
      // Vista en planta desde arriba (ligero offset en Z para que no degenere el up).
      return { position: [0, s * 1.8, 0.001], target };
  }
}
