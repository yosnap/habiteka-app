'use client';

import { useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { FreeWalkController } from './free-walk-controller';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { FreeWalkMap } from './free-walk-map';
import { FreeWalkGuide } from './free-walk-guide';
import styles from './free-walk-overlay.module.css';

export function FreeWalkOverlay({ paused, viewMode, controller, document, start, onPause, onExit, onMouse, onToggleView }: {
  paused: boolean;
  viewMode: 'first' | 'third';
  controller: FreeWalkController;
  document: EditorDocument;
  start: Point;
  onPause: () => void;
  onExit: () => void;
  onMouse: () => void;
  onToggleView: () => void;
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
      <span className={styles.hint}>↑/↓ caminar · ←/→ girar · A/D lateral · Mayús correr · R/F mirar arriba/abajo · V cambiar vista</span>
      <button type="button" className={styles.mouseButton} onClick={onMouse}>Activar ratón</button>
      <button type="button" className={styles.turnButton} disabled={paused} onClick={() => controller.look(-180, 0)}>↶ Girar izquierda</button>
      <button type="button" className={styles.turnButton} disabled={paused} onClick={() => controller.look(180, 0)}>Girar derecha ↷</button>
      <button type="button" disabled={paused} onClick={() => controller.look(0, -180)}>Mirar arriba ↑</button>
      <button type="button" disabled={paused} onClick={() => controller.look(0, 180)}>Mirar abajo ↓</button>
      <button type="button" onClick={onToggleView}>{viewMode === 'first' ? 'Ver en tercera persona' : 'Ver en primera persona'}</button>
      <button type="button" onClick={onPause}>{paused ? 'Continuar' : 'Pausar'}</button>
      <button type="button" onClick={onExit}>Salir</button>
    </div>
    {paused && <div className={styles.paused} role="status">Visita en pausa</div>}
    {viewMode === 'first' && <div className={styles.crosshair} aria-hidden="true">+</div>}
    <FreeWalkMap document={document} start={start} controller={controller} />
    <FreeWalkGuide document={document} start={start} controller={controller} />
    <div className={styles.touchControls}>
      <div className={styles.pad} aria-label="Avanzar, retroceder y girar">
        <button type="button" className={styles.up} aria-label="Avanzar" {...move('forward', 1)}>↑</button>
        <TurnButton direction={-1} className={styles.left} label="Girar a la izquierda" paused={paused} controller={controller}>←</TurnButton>
        <button type="button" className={styles.down} aria-label="Retroceder" {...move('forward', -1)}>↓</button>
        <TurnButton direction={1} className={styles.right} label="Girar a la derecha" paused={paused} controller={controller}>→</TurnButton>
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

function TurnButton({ direction, className, label, paused, controller, children }: {
  direction: -1 | 1;
  className?: string;
  label: string;
  paused: boolean;
  controller: FreeWalkController;
  children: ReactNode;
}) {
  const started = useRef<number | null>(null);
  const stop = () => { controller.move('turn', 0); started.current = null; };
  return <button type="button" className={className} aria-label={label} disabled={paused}
    onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      started.current = event.timeStamp; controller.move('turn', direction);
    }}
    onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
      const quickTap = started.current !== null && event.timeStamp - started.current < 160;
      stop();
      if (quickTap) controller.look(direction * 120, 0);
    }}
    onPointerCancel={stop} onLostPointerCapture={stop}
    onClick={(event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0 && !paused) controller.look(direction * 120, 0);
    }}>{children}</button>;
}
