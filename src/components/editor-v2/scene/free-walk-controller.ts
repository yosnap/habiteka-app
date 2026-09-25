/** Entrada efímera de la visita: no forma parte del documento ni de React. */
export interface FreeWalkPose { x: number; y: number; yaw: number }

export class FreeWalkController {
  private forward = 0;
  private strafe = 0;
  private lookX = 0;
  private lookY = 0;
  private pose: FreeWalkPose | null = null;
  private listeners = new Set<() => void>();

  getPose = () => this.pose;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  setPose(pose: FreeWalkPose | null) {
    this.pose = pose;
    this.listeners.forEach((listener) => listener());
  }

  move(axis: 'forward' | 'strafe', value: number) { this[axis] = value; }
  look(dx: number, dy: number) { this.lookX += dx; this.lookY += dy; }
  stop() { this.forward = 0; this.strafe = 0; this.lookX = 0; this.lookY = 0; }
  take() {
    const value = { forward: this.forward, strafe: this.strafe, lookX: this.lookX, lookY: this.lookY };
    this.lookX = 0; this.lookY = 0;
    return value;
  }
}
