/**
 * Mutaciones imperativas del lienzo WebGL y de los controles de cámara durante un arrastre. Viven fuera de los
 * componentes para que las reglas del compilador de React no las traten como mutaciones de valores de render.
 */
interface CanvasHost { domElement: HTMLCanvasElement }
export function setCanvasCursor(gl: CanvasHost, cursor: string): void { gl.domElement.style.cursor = cursor; }
export function captureCanvasPointer(gl: CanvasHost, pointerId: number): void { gl.domElement.setPointerCapture(pointerId); }
export function releaseCanvasPointer(gl: CanvasHost, pointerId: number): void {
  if (gl.domElement.hasPointerCapture(pointerId)) gl.domElement.releasePointerCapture(pointerId);
}
export function setControlsEnabled(controls: { enabled: boolean } | null | undefined, enabled: boolean): void {
  if (controls) controls.enabled = enabled;
}
