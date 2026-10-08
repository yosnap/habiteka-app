/**
 * Cortinas, estores y persianas de ventana. No son productos del catálogo (hidden): son ESTADOS de cada textil que la
 * app elige según la medida y la cobertura de la pieza (src/lib/editor-document/window-dressing-models.ts). Así se
 * conservan la cobertura regulable y el ajuste a la ventana sin deformar pliegues ni lamas:
 *   - Cortina de onda (cortina y cortina abierta): por ancho (120, 180, 260 y 360 cm), porque el ancho fija el paso de
 *     la onda; el alto solo alarga pliegues verticales. Cobertura 20 % (recogida), 40 %, 70 % y 100 %.
 *   - Estor enrollable, venecianas de 50 mm y persiana exterior: por alto (140 y 220 cm), porque el alto fija el paso de
 *     las lamas y el grueso del tubo o del cajón; el ancho solo alarga lamas horizontales. Cobertura 0–100 % cada 25 %.
 *   - Cortina de lamas verticales: por ancho, como la de onda; las lamas recogidas se apilan a la izquierda.
 * La clave de cada variante es `<medida en cm>_c<cobertura en %>`. Las telas y las lamas lacadas salen casi blancas y la
 * app las tiñe con el color de la pieza (huecos «tela» y «lamas»); la veneciana de madera conserva su textura.
 *
 * Todas mantienen la misma caja en cada cobertura (soportes, cadenas, guías o cordones fijan ancho, fondo y alto) para
 * que el escalado a la pieza sea igual en todos los estados.
 *
 * Python: scripts/blender/fam_textiles.py (BUILDERS).
 */
export const FAMILY = { id: 'textiles', label: 'Cortinas, estores y persianas', room: 'decoracion' };

const fabric = (texture, color, name, material) => ({ texture, color, swatch: color, name, material });
const flat = (kind, color, roughness, name, material, extra = {}) => ({ kind, color, swatch: color, roughness, name, material, ...extra });

export const FINISHES = {
  'textil-lino': fabric('lino', '#f4f2ed', 'Lino natural', 'Lino'),
  'textil-tejido': fabric('tejido', '#f2f0eb', 'Tejido técnico', 'Tejido técnico'),
  'textil-lacado': flat('paint', '#f3f3f1', .32, 'Aluminio lacado', 'Aluminio', { coat: .3 }),
  'textil-plastico': flat('paint', '#efeee9', .42, 'Plástico blanco', 'Plástico'),
  'textil-cordon': flat('paint', '#d3cfc6', .85, 'Cordón de poliéster', 'Poliéster'),
  'textil-goma': flat('paint', '#2a2b2c', .8, 'Goma', 'Goma'),
};

const WIDTHS = [120, 180, 260, 360];
const HEIGHTS = [140, 220];
const CURTAIN_COVERAGES = [20, 40, 70, 100];
const BLIND_COVERAGES = [0, 25, 50, 75, 100];

/** Variantes de estado: una por medida nominal y cobertura; Amueblar no las ve (hidden), pero la fábrica pide una. */
function states(sizes, coverages, dims, proposal, params = () => ({})) {
  return sizes.flatMap((size) => coverages.map((coverage) => ({
    key: `${size}_c${coverage}`, size: `${size} cm · ${coverage} %`, dims: dims(size),
    params: { coverage: coverage / 100, ...params(size) }, ...(size === proposal[0] && coverage === proposal[1] ? { proposal: true } : {}),
  })));
}

const hidden = (product) => ({ hidden: true, style: 'Contemporáneo', textureSize: 512, ...product });

export const PRODUCTS = [
  hidden({
    product: 'cortina_onda', type: 'curtain', label: 'Cortina de onda con barra y anillas', profile: 'curtain', mainSlot: 'tela',
    finishes: { tela: 'textil-lino', barra: 'metal-negro' },
    // Una onda cada 15 cm de cada paño cerrado.
    variants: states(WIDTHS, CURTAIN_COVERAGES, (size) => [size * 10, 180, 2400], [180, 100], (size) => ({ waves: Math.round(size * 10 / 2 / 150) })),
  }),
  hidden({
    product: 'estor_enrollable', type: 'roller', label: 'Estor enrollable', profile: 'roller', mainSlot: 'tela',
    finishes: { tela: 'textil-tejido', perfil: 'aluminio-blanco', soporte: 'textil-plastico', cadena: 'cromo' },
    variants: states(HEIGHTS, BLIND_COVERAGES, (size) => [1200, 80, size * 10], [140, 100]),
  }),
  hidden({
    product: 'veneciana_aluminio', type: 'venetian', label: 'Persiana veneciana de aluminio de 50 mm', profile: 'venetian', mainSlot: 'lamas',
    finishes: { lamas: 'textil-lacado', cordon: 'textil-cordon', mando: 'textil-plastico' },
    variants: states(HEIGHTS, BLIND_COVERAGES, (size) => [1200, 60, size * 10], [140, 100]),
  }),
  hidden({
    product: 'veneciana_madera', type: 'venetian', label: 'Persiana veneciana de madera de 50 mm', profile: 'venetian', mainSlot: 'madera',
    params: { wood: true }, finishes: { madera: 'fresno', cordon: 'textil-cordon', mando: 'fresno' },
    variants: states(HEIGHTS, BLIND_COVERAGES, (size) => [1200, 60, size * 10], [140, 100]),
  }),
  hidden({
    product: 'cortina_vertical', type: 'vertical_blind', label: 'Cortina de lamas verticales de 89 mm', profile: 'vertical-blind', mainSlot: 'tela',
    finishes: { tela: 'textil-tejido', perfil: 'aluminio-blanco', cadena: 'cromo', cordon: 'textil-cordon' },
    variants: states(WIDTHS, BLIND_COVERAGES, (size) => [size * 10, 100, 2400], [180, 100]),
  }),
  hidden({
    product: 'persiana_exterior', type: 'shutter', label: 'Persiana enrollable exterior de aluminio', profile: 'shutter', room: 'exterior',
    mainSlot: 'lamas', finishes: { lamas: 'textil-lacado', goma: 'textil-goma' },
    variants: states(HEIGHTS, BLIND_COVERAGES, (size) => [1200, 150, size * 10], [140, 100]),
  }),
];
