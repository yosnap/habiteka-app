import { events, type RootStore } from '@react-three/fiber';

/** WebGL puede terminar de arrancar después de desmontar el canvas anterior. */
export function scenePointerEvents(state: RootStore) {
  const manager = events(state);
  return { ...manager, connect: (target: HTMLElement) => {
    // R3F conecta desde una tarea asíncrona; su referencia DOM puede ser ya null.
    if (target) manager.connect?.(target);
  } };
}
