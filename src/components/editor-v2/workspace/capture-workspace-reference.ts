/** Copia solo el lienzo visible. No usa el flujo de renders, no altera la cámara ni genera diseños. */
export function captureWorkspaceReference(host: HTMLElement | null): void {
  if (!host) throw new Error('El lienzo todavía no está disponible');
  const layers = [...host.querySelectorAll<HTMLCanvasElement>('.konvajs-content canvas')].filter(canvas => !canvas.closest('[hidden]'));
  const canvases = layers.length ? layers : [...host.querySelectorAll<HTMLCanvasElement>('[data-workspace-scene] canvas')].slice(0, 1);
  const source = canvases[0];
  if (!source || !source.width || !source.height) throw new Error('Espera a que termine de cargar la vista');
  const scale = Math.min(1, 2400 / Math.max(source.width, source.height));
  const image = document.createElement('canvas');
  image.width = Math.round(source.width * scale); image.height = Math.round(source.height * scale) + 42;
  const context = image.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la captura');
  context.fillStyle = '#f5f4f0'; context.fillRect(0, 0, image.width, image.height);
  canvases.forEach(canvas => context.drawImage(canvas, 0, 0, image.width, image.height - 42));
  context.fillStyle = '#ffffff'; context.fillRect(0, image.height - 42, image.width, 42);
  context.fillStyle = '#24433b'; context.font = '14px sans-serif';
  context.fillText('Habiteka · Referencia de trabajo del plano guía', 12, image.height - 16);
  const link = document.createElement('a');
  link.download = 'habiteka-referencia-de-trabajo.png'; link.href = image.toDataURL('image/png'); link.click();
}
