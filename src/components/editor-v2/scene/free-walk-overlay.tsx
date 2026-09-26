'use client';

import { useRef, type PointerEvent } from 'react';
import type { FreeWalkController } from './free-walk-controller';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { FreeWalkMap } from './free-walk-map';
import styles from './free-walk-overlay.module.css';

export function FreeWalkOverlay({ paused, controller, document, start, onPause, onExit, onMouse }: {
  paused: boolean;
  controller: FreeWalkController;
  document: EditorDocument;
  start: Point;
  onPause: () => void;
  onExit: () => void;
  onMouse: () => void;
}) {
  const lastLook = useRef<{ x: number; y: number } | null>(null);
  const move = (axis: 'forward' | 'strafe', value: number) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (paused) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); controller.move(axis, value);
    },
    onPointerUp: () => { controller.move(axis, 0); },
    onPointerCancel: () => { controller.move(axis, 0); },
    onLostPointerCapture: () => { controller.move(axis, 0); },
  });
  return <div className={styles.overlay} aria-label="Visita inmersiva">
    <div className={styles.toolbar}>
      <strong>Visita inmersiva</strong>
      <span className={styles.hint}>WASD o flechas para caminar · R/F mirar arriba/abajo · activa el ratón y muévelo para mirar · Esc pausa</span>
      <button type="button" onClick={onMouse}>Activar ratón</button>
      <button type="button" disabled={paused} onClick={() => controller.look(0, -180)}>Mirar arriba ↑</button>
      <button type="button" disabled={paused} onClick={() => controller.look(0, 180)}>Mirar abajo ↓</button>
      <button type="button" onClick={onPause}>{paused ? 'Continuar' : 'Pausar'}</button>
      <button type="button" onClick={onExit}>Salir</button>
    </div>
    {paused && <div className={styles.paused} role="status">Visita en pausa</div>}
    <FreeWalkMap document={document} start={start} controller={controller} />
    <div className={styles.touchControls}>
      <div className={styles.pad} aria-label="Moverse">
        <button type="button" className={styles.up} aria-label="Avanzar" {...move('forward', 1)}>↑</button>
        <button type="button" className={styles.left} aria-label="Ir a la izquierda" {...move('strafe', -1)}>←</button>
        <button type="button" className={styles.down} aria-label="Retroceder" {...move('forward', -1)}>↓</button>
        <button type="button" className={styles.right} aria-label="Ir a la derecha" {...move('strafe', 1)}>→</button>
      </div>
      <div className={styles.look} role="group" aria-label="Mirar alrededor"
        onPointerDown={(event) => { if (paused) return; event.currentTarget.setPointerCapture(event.pointerId); lastLook.current = { x: event.clientX, y: event.clientY }; }}
        onPointerMove={(event) => {
          if (!lastLook.current) return;
          controller.look(event.clientX - lastLook.current.x, event.clientY - lastLook.current.y);
          lastLook.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={() => { lastLook.current = null; }} onPointerCancel={() => { lastLook.current = null; }}>
        Arrastra para mirar
      </div>
    </div>
  </div>;
}
