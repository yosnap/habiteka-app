/** Nombre de archivo seguro para descargar una vista: sin acentos, en minúsculas y con guiones. */
export function captureFileName(label: string, index: number): string {
  const slug = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || `vista-${index + 1}`}.png`;
}
