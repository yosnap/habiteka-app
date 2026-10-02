import { describe, expect, it, vi } from 'vitest';
import type { RootStore } from '@react-three/fiber';
const manager = vi.hoisted(() => ({ connect: vi.fn(), disconnect: vi.fn(), enabled: true, priority: 1 }));
vi.mock('@react-three/fiber', () => ({ events: () => manager }));
import { scenePointerEvents } from '@/components/editor-v2/scene/scene-pointer-events';

describe('conexión tardía de WebGL al cambiar de vista', () => {
  it('omite el DOM desmontado y mantiene la conexión y desconexión normales', () => {
    const events = scenePointerEvents({} as RootStore);
    events.connect(null as unknown as HTMLElement);
    expect(manager.connect).not.toHaveBeenCalled();
    const node = {} as HTMLElement;
    events.connect(node);
    expect(manager.connect).toHaveBeenCalledWith(node);
    expect(events.disconnect).toBe(manager.disconnect);
    expect(events.enabled).toBe(true);
  });
});
