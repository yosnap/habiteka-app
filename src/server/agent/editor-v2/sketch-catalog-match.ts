import { FURNITURE_CATALOG, getFurnitureCatalogEntry, normalizeFurnitureSearch } from '@/lib/editor-document/furniture-catalog';
import { listedForProposal } from '@/lib/editor-document/habiteka-furniture';

/**
 * Lo que no es una pieza suelta: un tramo de encimera (va al mueble de cocina), las sillas de una mesa (las pone el
 * sistema) o la barra de la cocina americana (exenta, con el frente hacia sus taburetes, que pone el sistema).
 */
export type SketchRole = 'kitchen' | 'chairs' | 'bar';
export interface SketchMatch { catalogId?: string; role?: SketchRole }

/**
 * Qué pieza del catálogo corresponde a cada objeto leído en el boceto, por su nombre. El orden importa: lo concreto
 * antes que lo general («silla de escritorio» antes que «silla», «cama individual» antes que «cama»). Lo que no casa con
 * nada no está en el catálogo y se le dice al cliente en lugar de sustituirlo por otra cosa.
 */
/**
 * Pieza del catálogo cuyo id cumple el patrón, la de su estancia antes que otra (un espejo de recibidor antes que el
 * del baño). Para objetos que solo traen algunas familias: si aún no existe, el objeto se avisa como que falta.
 */
function catalogPiece(pattern: RegExp, room?: string): SketchMatch | null {
  const found = FURNITURE_CATALOG.filter((entry) => pattern.test(entry.id) && listedForProposal(entry))
    .sort((a, b) => Number(b.room === room) - Number(a.room === room))[0];
  return found ? { catalogId: found.id } : null;
}

/** null: objeto reconocido que el catálogo aún no tiene (se avisa al cliente en lugar de sustituirlo). */
const RULES: readonly (readonly [RegExp, SketchMatch | null])[] = [
  // Infantil, recibidor y garaje: antes que la cama, el banco o la estantería genéricos.
  [/cuna|minicuna/, catalogPiece(/cuna/, 'infantil')],
  [/litera/, catalogPiece(/litera/, 'infantil')],
  [/^(mesa )?consola/, catalogPiece(/consola/, 'recibidor')],
  [/^perchero/, catalogPiece(/perchero/, 'recibidor')],
  // Con la palabra al principio: un «armario con espejo» sigue siendo un armario.
  [/^espejo/, catalogPiece(/espejo/, 'recibidor')],
  [/^tendedero/, catalogPiece(/tendedero/, 'lavadero')],
  [/estanteria (metalica|de metal)|estanteria de garaje/, catalogPiece(/estanteria[-_](acero|metal)/, 'garaje')],
  // Antes que la encimera: una isla con placa sigue siendo una pieza exenta, no un tramo contra la pared.
  [/\b(isla|peninsula)\b|^barra\b|\bbarra (de )?(cocina|americana|desayuno|bar)\b/, { catalogId: 'habiteka:furniture:isla-cocina', role: 'bar' }],
  [/mesa (alta|de barra|bar)\b/, { catalogId: 'habiteka:asset:mesa_alta_redonda', role: 'bar' }],
  // Antes que la mesa y la mesilla: «lámpara de mesa» o «lámpara de mesilla» son lámparas, no la mesa sobre la que van.
  [/^lampara de pie/, { catalogId: 'habiteka:furniture:lampara-pie' }],
  [/^lampara/, { catalogId: 'habiteka:furniture:lampara-mesa' }],
  [/encimera|bancada|cocina (lineal|en l)|mueble (bajo )?de cocina|modulo de cocina|placa|vitro|fogon|fregadero|horno|lavavajillas/, { role: 'kitchen' }],
  // Con la palabra entera: «mesilla» también contiene «silla».
  [/\bsillas? (de )?(escritorio|oficina|estudio)/, { catalogId: 'habiteka:furniture:silla-oficina' }],
  [/taburete|\bsillas? (altas?|de barra)\b/, { catalogId: 'habiteka:furniture:taburete' }],
  [/\bsillas?\b/, { role: 'chairs' }],
  [/cama.*(individual|sencilla|nido|90)/, { catalogId: 'habiteka:furniture:cama-individual' }],
  [/cama/, { catalogId: 'habiteka:furniture:cama-doble' }],
  [/mesilla|mesita de noche/, { catalogId: 'habiteka:furniture:mesita' }],
  [/armario|ropero/, { catalogId: 'habiteka:furniture:armario' }],
  [/escritorio/, { catalogId: 'habiteka:furniture:escritorio' }],
  [/sofa cama/, { catalogId: 'habiteka:furniture:sofa-cama' }],
  [/sofa.*\b(l|esquina|rincon)|rinconera/, { catalogId: 'habiteka:furniture:rinconera' }],
  [/chaise/, { catalogId: 'habiteka:furniture:chaise-longue' }],
  [/sofa/, { catalogId: 'habiteka:furniture:sofa-3' }],
  [/butaca|sillon/, { catalogId: 'habiteka:furniture:butaca' }],
  [/mesa (de )?centro|mesa baja/, { catalogId: 'habiteka:furniture:mesa-centro' }],
  [/mesa auxiliar/, { catalogId: 'habiteka:furniture:mesa-auxiliar' }],
  [/mueble (de )?(tv|television|tele)|television/, { catalogId: 'habiteka:furniture:mueble-tv' }],
  [/alfombra/, { catalogId: 'habiteka:furniture:alfombra' }],
  [/banera/, { catalogId: 'habiteka:furniture:banera' }],
  [/pila|lavadero/, { catalogId: 'habiteka:furniture:pila-lavadero' }],
  [/zapatero|mueble de entrada/, { catalogId: 'habiteka:furniture:zapatero' }],
  [/columna (de )?bano/, { catalogId: 'habiteka:furniture:columna-bano' }],
  [/columna/, { catalogId: 'habiteka:furniture:mueble-columna' }],
  [/felpudo/, { catalogId: 'habiteka:furniture:felpudo' }],
  [/cest[oa]/, { catalogId: 'habiteka:furniture:cesto-ropa' }],
  [/ducha/, { catalogId: 'habiteka:furniture:ducha' }],
  [/inodoro|vater|retrete|wc/, { catalogId: 'habiteka:furniture:inodoro' }],
  [/lavabo/, { catalogId: 'habiteka:furniture:lavabo' }],
  [/lavadora/, { catalogId: 'habiteka:furniture:lavadora' }],
  [/secadora/, { catalogId: 'habiteka:furniture:secadora' }],
  [/frigorifico|nevera/, { catalogId: 'habiteka:furniture:frigorifico' }],
  [/mesa.*(exterior|jardin|terraza)/, { catalogId: 'habiteka:furniture:mesa-jardin' }],
  [/mesa (de )?cocina/, { catalogId: 'habiteka:furniture:mesa-cocina' }],
  [/mesa (de )?comedor|mesa/, { catalogId: 'habiteka:furniture:mesa-comedor' }],
  [/planta|maceta/, { catalogId: 'habiteka:furniture:planta' }],
  [/jarron|florero/, { catalogId: 'habiteka:asset:jarron_ceramica' }],
  [/lampara de pie/, { catalogId: 'habiteka:furniture:lampara-pie' }],
  [/lampara/, { catalogId: 'habiteka:furniture:lampara-mesa' }],
  [/estanteria|libreria/, { catalogId: 'habiteka:furniture:libreria' }],
  [/comoda/, { catalogId: 'habiteka:furniture:comoda' }],
  [/aparador/, { catalogId: 'habiteka:furniture:aparador' }],
  [/banco/, { catalogId: 'habiteka:furniture:banco-comedor' }],
  [/cortina/, { catalogId: 'habiteka:furniture:cortina' }],
];

/** Pieza o papel de un objeto leído en el boceto; null si el catálogo no tiene nada así (una cuna, un perchero…). */
export function matchSketchItem(name: string): SketchMatch | null {
  const key = normalizeFurnitureSearch(name);
  const match = RULES.find(([pattern]) => pattern.test(key))?.[1];
  if (!match) return null;
  return match.catalogId && !getFurnitureCatalogEntry(match.catalogId) ? null : match;
}
