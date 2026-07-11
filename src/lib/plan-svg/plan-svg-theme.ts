/**
 * Tema del plano técnico: todos los parámetros visuales en un solo objeto para
 * no esparcir colores/grosores por el renderer. Las magnitudes lineales están
 * en MILÍMETROS del plano (el SVG comparte ese espacio vía viewBox), de modo
 * que el dibujo escala con el plano sin recalcular nada.
 */
export interface PlanSvgTheme {
  /** Fondo del papel. */
  background: string;
  /** Relleno del suelo de cada estancia. */
  floorFill: string;
  /** Relleno macizo de los muros (poché). */
  wallFill: string;
  /** Color de línea general (símbolos, cotas, jambas). */
  lineColor: string;
  /** Color del texto (etiquetas y cotas). */
  textColor: string;
  /** Grosor de línea fina (cotas, vidrio de ventana). */
  thinLineMm: number;
  /** Grosor de línea de símbolo (hoja y arco de puerta, jambas). */
  symbolLineMm: number;
  fontFamily: string;
  /** Tamaño del nombre de estancia. */
  labelFontMm: number;
  /** Tamaño de la superficie (m²) bajo el nombre. */
  areaFontMm: number;
  /** Tamaño del texto de cota. */
  dimFontMm: number;
  /** Separación de la línea de cota respecto al muro. */
  dimOffsetMm: number;
  /** Semilongitud del tick oblicuo en los extremos de cota. */
  dimTickMm: number;
  /** Margen del papel alrededor del dibujo (debe absorber cotas y textos). */
  paddingMm: number;
}

export const DEFAULT_PLAN_SVG_THEME: PlanSvgTheme = {
  background: '#ffffff',
  floorFill: '#f6f4f0',
  wallFill: '#26221f',
  lineColor: '#26221f',
  textColor: '#26221f',
  thinLineMm: 15,
  symbolLineMm: 22,
  fontFamily: 'Helvetica, Arial, sans-serif',
  labelFontMm: 280,
  areaFontMm: 210,
  dimFontMm: 200,
  dimOffsetMm: 550,
  dimTickMm: 90,
  paddingMm: 1400,
};
