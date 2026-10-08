/** Imagen original alineada al sistema de coordenadas del plano importado. */
export interface PlanReference {
  imageUrl: string;
  widthMm: number;
  heightMm: number;
  xMm?: number;
  yMm?: number;
  /** Imágenes que pueden hacer de fondo (original y redibujados) y la activa, para elegir en el editor. */
  choices?: { projectId: string; activeKey?: string; options: Array<{ assetKey: string; label: string }> };
}
