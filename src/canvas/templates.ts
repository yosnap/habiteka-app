/**
 * Plantillas de sala builtin para el template picker modal.
 * Cada plantilla define exactamente QUÉ muebles hay y DÓNDE van,
 * sin depender de autofurnish (que no garantiza layouts estéticos).
 *
 * Constantes de coordenadas:
 *   ORIGIN = 120px  (build-room-doc: ORIGIN_PX)
 *   PPM    = 100    (px por metro)
 *   WALL   = 15px   (DEFAULT_WALL_THICKNESS_M × PPM)
 *
 * El interior de una sala WxL (metros) empieza en (ORIGIN+WALL, ORIGIN+WALL)
 * y mide (W×PPM − 2×WALL, L×PPM − 2×WALL) px.
 */
import { buildShapeDoc } from './wizard/build-room-doc';
import { CATALOG_BY_KIND } from './catalog';
import type { CanvasDoc, StructObj, StructKind } from './types';
import type { RoomShapeParams } from './wizard/room-shapes';

export interface BuiltinTemplate {
  id: string;
  label: string;
  description: string;
  shapeParams: RoomShapeParams;
  ceilingM: number;
  doc: CanvasDoc;
}

// ── Constantes de layout ──────────────────────────────────────────────────────

const ORIGIN = 120;  // margen del lienzo (ORIGIN_PX en build-room-doc)
const PPM    = 100;  // px por metro
const WALL   = 15;   // grosor de muro en px (0.15m × 100)
const G      = 5;    // hueco entre mueble y pared / entre muebles

/** Coordenadas del borde INTERIOR de la sala en px. */
function ix(widthM: number)  { return ORIGIN + WALL; }
function iy(lengthM: number) { return ORIGIN + WALL; }
function iw(widthM: number)  { return Math.round(widthM  * PPM) - 2 * WALL; }
function ih(lengthM: number) { return Math.round(lengthM * PPM) - 2 * WALL; }

/** Crea un StructObj a partir del kind del catálogo y una posición de esquina TL. */
function obj(id: string, kind: StructKind, x: number, y: number, rotation = 0): StructObj {
  const entry = CATALOG_BY_KIND[kind];
  const w = Math.round((entry?.realWidthM ?? 0.5) * PPM);
  const h = Math.round((entry?.realDepthM ?? 0.5) * PPM);
  return { id, kind, x: Math.round(x), y: Math.round(y), width: w, height: h, rotation };
}

/** Centra horizontalmente un objeto de anchura `objW` dentro del interior de `widthM`. */
function centerX(widthM: number, objW: number) {
  return ix(widthM) + (iw(widthM) - objW) / 2;
}

/** Borde S interior (coordenada y de la pared sur interior). */
function innerBottom(lengthM: number) { return iy(lengthM) + ih(lengthM); }

/** Borde E interior (coordenada x de la pared este interior). */
function innerRight(widthM: number)   { return ix(widthM) + iw(widthM); }

/** Combina las paredes del buildShapeDoc con muebles explícitos. */
function makeTemplate(
  id: string,
  label: string,
  description: string,
  shapeParams: RoomShapeParams,
  ceilingM: number,
  furniture: StructObj[],
): BuiltinTemplate {
  const roomDoc = buildShapeDoc({ shape: shapeParams, ceilingHeightM: ceilingM });
  const doc: CanvasDoc = {
    ...roomDoc,
    objects: [...roomDoc.objects, ...furniture],
  };
  return { id, label, description, shapeParams, ceilingM, doc };
}

// ── Plantillas ────────────────────────────────────────────────────────────────

/**
 * 1. Dormitorio principal — 4 × 3.5 m
 *
 * Layout:
 *   Pared N: [mesilla izq] [cama matrimonial centrada] [mesilla der]
 *   Pared S: [armario centrado]
 *
 * Interior: (135,135) 370×320 px
 */
function dormitorioPrincipal(): BuiltinTemplate {
  const W = 4, L = 3.5;
  const camaW = Math.round(CATALOG_BY_KIND.cama!.realWidthM    * PPM); // 150
  const mesW  = Math.round(CATALOG_BY_KIND.mesilla!.realWidthM  * PPM); // 45
  const armW  = Math.round(CATALOG_BY_KIND.armario!.realWidthM  * PPM); // 120
  const armH  = Math.round(CATALOG_BY_KIND.armario!.realDepthM  * PPM); // 60

  const camaX = centerX(W, camaW);
  const camaY = iy(L) + G;

  return makeTemplate(
    'dormitorio-principal',
    'Dormitorio principal',
    'Cama doble con mesillas a los lados y armario al frente.',
    { shape: 'rect', widthM: W, lengthM: L },
    2.5,
    [
      obj('t1-mes-l', 'mesilla', camaX - G - mesW, camaY),
      obj('t1-cama',  'cama',    camaX,              camaY),
      obj('t1-mes-r', 'mesilla', camaX + camaW + G,  camaY),
      obj('t1-arm',   'armario', centerX(W, armW), innerBottom(L) - G - armH),
    ],
  );
}

/**
 * 2. Salón comedor — 5 × 4 m
 *
 * Layout:
 *   Zona salón  (N): TV en pared N + sofá centrado mirando al TV
 *   Zona comedor (S): mesa con 4 sillas
 *
 * Interior: (135,135) 470×370 px
 */
function salonComedor(): BuiltinTemplate {
  const W = 5, L = 4;
  const sofaW  = Math.round(CATALOG_BY_KIND.sofa!.realWidthM  * PPM); // 200
  const tvW    = Math.round(CATALOG_BY_KIND.tv!.realWidthM    * PPM); // 120
  const mesaW  = Math.round(CATALOG_BY_KIND.mesa!.realWidthM  * PPM); // 120
  const mesaH  = Math.round(CATALOG_BY_KIND.mesa!.realDepthM  * PPM); // 80
  const sillaW = Math.round(CATALOG_BY_KIND.silla!.realWidthM * PPM); // 45
  const sillaH = Math.round(CATALOG_BY_KIND.silla!.realDepthM * PPM); // 45

  // TV: pared N centrado
  const tvX = centerX(W, tvW);
  const tvY = iy(L) + G;

  // Sofá: zona salón, centrado, a ≈ 1/3 de altura
  const sofaX = centerX(W, sofaW);
  const sofaY = iy(L) + Math.round(ih(L) * 0.28);

  // Mesa comedor: zona comedor, centrada, ≈ 65% de altura
  const mesaX = centerX(W, mesaW);
  const mesaY = iy(L) + Math.round(ih(L) * 0.6);

  // Silla arriba (frente a la mesa): centrada, encima de la mesa
  const sillaTopX = mesaX + Math.round((mesaW - sillaW) / 2);
  // Silla abajo: debajo de la mesa
  const sillaBotX = sillaTopX;
  // Sillas laterales: a los lados de la mesa
  const sillaLY = mesaY + Math.round((mesaH - sillaH) / 2);

  return makeTemplate(
    'salon-comedor',
    'Salón comedor',
    'Zona de sofá con TV y zona de comedor con mesa para 4.',
    { shape: 'rect', widthM: W, lengthM: L },
    2.7,
    [
      obj('t2-tv',     'tv',     tvX,                  tvY),
      obj('t2-sofa',   'sofa',   sofaX,                sofaY,   180),
      obj('t2-mesa',   'mesa',   mesaX,                mesaY),
      obj('t2-sil-t',  'silla',  sillaTopX,            mesaY - G - sillaH, 180),
      obj('t2-sil-b',  'silla',  sillaBotX,            mesaY + mesaH + G),
      obj('t2-sil-l',  'silla',  mesaX - G - sillaW,   sillaLY),
      obj('t2-sil-r',  'silla',  mesaX + mesaW + G,    sillaLY),
    ],
  );
}

/**
 * 3. Cocina — 3.5 × 3 m
 *
 * Layout:
 *   Pared N: fregadero | vitro | horno (encimera en línea)
 *   Pared E: nevera
 *   Centro:  isla de cocina
 *
 * Interior: (135,135) 320×270 px
 */
function cocinaAbierta(): BuiltinTemplate {
  const W = 3.5, L = 3;
  const freW  = Math.round(CATALOG_BY_KIND.fregadero!.realWidthM    * PPM); // 80
  const vitW  = Math.round(CATALOG_BY_KIND.vitroceramica!.realWidthM * PPM); // 60
  const horW  = Math.round(CATALOG_BY_KIND.horno!.realWidthM        * PPM); // 60
  const nevW  = Math.round(CATALOG_BY_KIND.nevera!.realWidthM       * PPM); // 70
  const islaW = Math.round(CATALOG_BY_KIND.isla!.realWidthM         * PPM); // 160
  const islaH = Math.round(CATALOG_BY_KIND.isla!.realDepthM         * PPM); // 90

  const topY = iy(L) + G;

  // Encimera N: fregadero + vitro + horno en fila desde la izquierda
  const freX  = ix(W) + G;
  const vitX  = freX + freW + G;
  const horX  = vitX + vitW + G;

  // Nevera: pared E, parte N
  const nevX  = innerRight(W) - G - nevW;
  const nevY  = topY;

  // Isla: centro del interior restante
  const islaX = ix(W) + Math.round((iw(W) - islaW) / 2);
  const islaY = iy(L) + Math.round((ih(L) - islaH) / 2) + 20;

  return makeTemplate(
    'cocina-abierta',
    'Cocina',
    'Encimera en línea con fregadero, vitro, horno e isla central.',
    { shape: 'rect', widthM: W, lengthM: L },
    2.4,
    [
      obj('t3-fre',  'fregadero',    freX,  topY),
      obj('t3-vit',  'vitroceramica', vitX, topY),
      obj('t3-hor',  'horno',        horX,  topY),
      obj('t3-nev',  'nevera',       nevX,  nevY),
      obj('t3-isla', 'isla',         islaX, islaY),
    ],
  );
}

/**
 * 4. Estudio / Oficina — 3 × 3 m
 *
 * Layout:
 *   Pared N: armario izq + estantería der
 *   Pared S: mesa (escritorio) centrada
 *   Silla enfrente de la mesa
 *
 * Interior: (135,135) 270×270 px
 */
function estudioOficina(): BuiltinTemplate {
  const W = 3, L = 3;
  const armW  = Math.round(CATALOG_BY_KIND.armario!.realWidthM   * PPM); // 120
  const mesaW = Math.round(CATALOG_BY_KIND.mesa!.realWidthM       * PPM); // 120
  const mesaH = Math.round(CATALOG_BY_KIND.mesa!.realDepthM        * PPM); // 80
  const silW  = Math.round(CATALOG_BY_KIND.silla!.realWidthM       * PPM); // 45
  const silH  = Math.round(CATALOG_BY_KIND.silla!.realDepthM       * PPM); // 45

  const topY = iy(L) + G;

  // Armario: pared N, izquierda
  const armX  = ix(W) + G;
  // Estantería: pared N, derecha del armario
  const estX  = armX + armW + G;
  // Mesa: pared S, centrada
  const mesaX = centerX(W, mesaW);
  const mesaY = innerBottom(L) - G - mesaH;
  // Silla: frente a la mesa (entre la mesa y el centro de la sala)
  const silX  = mesaX + Math.round((mesaW - silW) / 2);
  const silY  = mesaY - G - silH;

  return makeTemplate(
    'estudio-oficina',
    'Estudio / Oficina',
    'Armario y estantería al fondo, escritorio con silla.',
    { shape: 'rect', widthM: W, lengthM: L },
    2.5,
    [
      obj('t4-arm', 'armario',    armX,  topY),
      obj('t4-est', 'estanteria', estX,  topY),
      obj('t4-mes', 'mesa',       mesaX, mesaY),
      obj('t4-sil', 'silla',      silX,  silY,  180),
    ],
  );
}

/**
 * 5. Baño completo — 2.5 × 2.5 m
 *
 * Layout:
 *   Pared O (izq): lavabo (N) + inodoro (S)
 *   Pared E (der): ducha
 *
 * Interior: (135,135) 220×220 px
 */
function banoCompleto(): BuiltinTemplate {
  const W = 2.5, L = 2.5;
  const wcH   = Math.round(CATALOG_BY_KIND.inodoro!.realDepthM * PPM); // 60
  const dchW  = Math.round(CATALOG_BY_KIND.ducha!.realWidthM   * PPM); // 90

  // Lavabo: pared O, parte N
  const lavX = ix(W) + G;
  const lavY = iy(L) + G;

  // Inodoro: pared O, parte S
  const wcX = ix(W) + G;
  const wcY = innerBottom(L) - G - wcH;

  // Ducha: pared E, parte N
  const dchX = innerRight(W) - G - dchW;
  const dchY = iy(L) + G;

  return makeTemplate(
    'bano-completo',
    'Baño completo',
    'Lavabo y WC en la pared izquierda, ducha en la derecha.',
    { shape: 'rect', widthM: W, lengthM: L },
    2.4,
    [
      obj('t5-lav', 'lavabo',   lavX, lavY),
      obj('t5-wc',  'inodoro',  wcX,  wcY),
      obj('t5-dch', 'ducha',    dchX, dchY),
    ],
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  dormitorioPrincipal(),
  salonComedor(),
  cocinaAbierta(),
  estudioOficina(),
  banoCompleto(),
];
