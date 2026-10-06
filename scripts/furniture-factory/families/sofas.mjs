/**
 * Sofás, butacas y pufs. Medidas de mercado en mm: [ancho, fondo, alto]. Cada variante hereda los parámetros y
 * acabados del producto; `size` es la parte de medida del nombre de la variante (el acabado se añade solo).
 * `proposal` marca la variante que ve Amueblar en su lista (las demás medidas se prueban al no caber).
 */
const sizes = (list) => list.map(([key, size, dims, params, extra]) => ({ key, size, dims, params, ...extra }));

export const FAMILY = { id: 'sofas', label: 'Sofás, chaise longue, butacas y pufs', room: 'salon' };

export const PRODUCTS = [
  {
    product: 'sofa_moderno', type: 'sofa', label: 'Sofá moderno recto', profile: 'sofa', style: 'Contemporáneo',
    params: { style: 'moderno' }, finishes: { tapiceria: 'lino-gris', patas: 'metal-negro' },
    variants: [
      ...sizes([
        ['2p', '2 plazas · 180 cm', [1800, 950, 820], { seats: 2 }],
        ['3p', '3 plazas · 220 cm', [2200, 950, 820], { seats: 3 }, { proposal: true }],
        ['4p', '4 plazas · 260 cm', [2600, 950, 820], { seats: 4 }],
      ]),
      { key: '3p_boucle', size: '3 plazas · 220 cm', dims: [2200, 950, 820], params: { seats: 3 }, finishes: { tapiceria: 'boucle-crudo' } },
      { key: '3p_terciopelo', size: '3 plazas · 220 cm', dims: [2200, 950, 820], params: { seats: 3 }, finishes: { tapiceria: 'terciopelo-verde' } },
      { key: '3p_antracita', size: '3 plazas · 220 cm', dims: [2200, 950, 820], params: { seats: 3 }, finishes: { tapiceria: 'tejido-antracita' } },
    ],
  },
  {
    product: 'sofa_nordico', type: 'sofa', label: 'Sofá nórdico con patas de madera', profile: 'sofa', style: 'Nórdico',
    params: { style: 'escandinavo' }, finishes: { tapiceria: 'tejido-beige', patas: 'roble' },
    variants: [
      ...sizes([
        ['2p', '2 plazas · 165 cm', [1650, 860, 800], { seats: 2 }],
        ['3p', '3 plazas · 205 cm', [2050, 860, 800], { seats: 3 }, { proposal: true }],
        ['4p', '4 plazas · 245 cm', [2450, 860, 800], { seats: 4 }],
      ]),
      { key: '3p_azul', size: '3 plazas · 205 cm', dims: [2050, 860, 800], params: { seats: 3 }, finishes: { tapiceria: 'tejido-azul' } },
      { key: '3p_mostaza', size: '3 plazas · 205 cm', dims: [2050, 860, 800], params: { seats: 3 }, finishes: { tapiceria: 'terciopelo-mostaza' } },
    ],
  },
  {
    product: 'sofa_brazo_fino', type: 'sofa', label: 'Sofá de brazos finos', profile: 'sofa', style: 'Contemporáneo',
    params: { style: 'brazos_finos' }, finishes: { tapiceria: 'espiga-gris', patas: 'metal-negro' },
    variants: [
      ...sizes([
        ['2p', '2 plazas · 160 cm', [1600, 880, 780], {}],
        ['3p', '3 plazas · 200 cm', [2000, 880, 780], {}, { proposal: true }],
        ['4p', '4 plazas · 240 cm', [2400, 880, 780], {}],
      ]),
      { key: '3p_arena', size: '3 plazas · 200 cm', dims: [2000, 880, 780], finishes: { tapiceria: 'lino-arena' } },
    ],
  },
  {
    product: 'sofa_capitone', type: 'sofa', label: 'Sofá Chester capitoné', profile: 'sofa', style: 'Clásico',
    params: { style: 'capitone' }, finishes: { tapiceria: 'piel-conac', patas: 'nogal' },
    variants: [
      { key: '2p', size: '2 plazas · 170 cm', dims: [1700, 900, 740], params: { seats: 2 } },
      { key: '3p', size: '3 plazas · 215 cm', dims: [2150, 900, 740], params: { seats: 3 }, proposal: true },
      { key: '3p_verde', size: '3 plazas · 215 cm', dims: [2150, 900, 740], params: { seats: 3 }, finishes: { tapiceria: 'terciopelo-verde' } },
      { key: '2p_azul', size: '2 plazas · 170 cm', dims: [1700, 900, 740], params: { seats: 2 }, finishes: { tapiceria: 'terciopelo-azul' } },
    ],
  },
  {
    product: 'sofa_chaise', type: 'chaise', label: 'Sofá con chaise longue', profile: 'sofa-chaise', style: 'Contemporáneo',
    params: { style: 'moderno', seat_depth: 950, chaise_w: 900 }, finishes: { tapiceria: 'lino-gris', patas: 'metal-negro' },
    variants: [
      { key: 'izquierda_3p', size: '3 plazas · chaise a la izquierda · 270 cm', dims: [2700, 1600, 820], params: { side: 'izquierda' }, proposal: true },
      { key: 'derecha_3p', size: '3 plazas · chaise a la derecha · 270 cm', dims: [2700, 1600, 820], params: { side: 'derecha' } },
      { key: 'izquierda_4p', size: '4 plazas · chaise a la izquierda · 310 cm', dims: [3100, 1650, 820], params: { side: 'izquierda' } },
      { key: 'derecha_4p', size: '4 plazas · chaise a la derecha · 310 cm', dims: [3100, 1650, 820], params: { side: 'derecha' } },
      { key: 'izquierda_3p_boucle', size: '3 plazas · chaise a la izquierda · 270 cm', dims: [2700, 1600, 820], params: { side: 'izquierda' }, finishes: { tapiceria: 'boucle-arena' } },
    ],
  },
  {
    product: 'meridiana', type: 'daybed', label: 'Chaise longue independiente (meridiana)', profile: 'sofa-chaise', style: 'Contemporáneo',
    params: { style: 'escandinavo' }, finishes: { tapiceria: 'lino-arena', patas: 'roble' },
    variants: [
      { key: 'izquierda', size: 'Respaldo a la izquierda · 185 cm', dims: [1850, 760, 800], params: { side: 'izquierda' }, proposal: true },
      { key: 'derecha', size: 'Respaldo a la derecha · 185 cm', dims: [1850, 760, 800], params: { side: 'derecha' } },
      { key: 'izquierda_verde', size: 'Respaldo a la izquierda · 185 cm', dims: [1850, 760, 800], params: { side: 'izquierda' }, finishes: { tapiceria: 'terciopelo-verde', patas: 'nogal' } },
    ],
  },
  {
    product: 'chaise_dormitorio', type: 'chaise_classic', label: 'Chaise longue de dormitorio', profile: 'sofa-chaise', style: 'Clásico',
    room: 'dormitorio', finishes: { tapiceria: 'terciopelo-rosa', patas: 'nogal' },
    variants: [
      { key: 'rosa', size: 'Cabecera a la izquierda · 160 cm', dims: [1600, 650, 850], params: { side: 'izquierda' }, proposal: true },
      { key: 'lino', size: 'Cabecera a la derecha · 160 cm', dims: [1600, 650, 850], params: { side: 'derecha' }, finishes: { tapiceria: 'lino-blanco', patas: 'fresno' } },
    ],
  },
  {
    product: 'sofa_rinconera', type: 'corner', label: 'Sofá rinconera en L', profile: 'sofa-corner', style: 'Contemporáneo',
    params: { style: 'moderno', seat_depth: 950 }, finishes: { tapiceria: 'tejido-antracita', patas: 'metal-negro' },
    variants: [
      { key: 'izquierda', size: 'Rincón a la izquierda · 280 × 210 cm', dims: [2800, 2100, 820], params: { side: 'izquierda' }, proposal: true },
      { key: 'derecha', size: 'Rincón a la derecha · 280 × 210 cm', dims: [2800, 2100, 820], params: { side: 'derecha' } },
      { key: 'izquierda_arena', size: 'Rincón a la izquierda · 280 × 210 cm', dims: [2800, 2100, 820], params: { side: 'izquierda' }, finishes: { tapiceria: 'lino-arena' } },
    ],
  },
  {
    product: 'sofa_cama', type: 'sofa_bed', label: 'Sofá cama de apertura italiana', profile: 'sofa-bed', style: 'Contemporáneo',
    params: { style: 'brazos_finos', seat_depth: 950 },
    finishes: { tapiceria: 'tejido-azul', patas: 'metal-negro', metal: 'metal-negro', sabanas: 'algodon-blanco', plaid: 'punto-mostaza' },
    variants: [
      { key: 'cerrado', size: 'Cerrado · 200 cm', dims: [2000, 950, 850], proposal: true },
      { key: 'abierto', size: 'Abierto · cama 140 × 190 cm', dims: [2000, 2150, 850], params: { open: true } },
    ],
  },
  {
    product: 'sofa_modular', type: 'module', label: 'Sofá modular por módulos', profile: 'sofa-modular', style: 'Contemporáneo',
    params: { style: 'moderno', seat_th: .18 }, finishes: { tapiceria: 'boucle-arena', patas: 'metal-negro' },
    variants: [
      { key: 'central', size: 'Módulo central · 90 cm', dims: [900, 1000, 800], params: { module: 'central' }, proposal: true },
      { key: 'brazo_izq', size: 'Módulo con brazo izquierdo · 107 cm', dims: [1070, 1000, 800], params: { module: 'brazo_izq' } },
      { key: 'brazo_dcho', size: 'Módulo con brazo derecho · 107 cm', dims: [1070, 1000, 800], params: { module: 'brazo_dcho' } },
      { key: 'esquina', size: 'Módulo de esquina · 100 × 100 cm', dims: [1000, 1000, 800], params: { module: 'esquina' } },
      { key: 'chaise', size: 'Módulo chaise · 90 × 160 cm', dims: [900, 1600, 800], params: { module: 'chaise' } },
      { key: 'puf', size: 'Puf modular · 90 × 90 cm', dims: [900, 900, 440], params: { module: 'puf' } },
    ],
  },
  {
    product: 'butaca_tapizada', type: 'armchair', label: 'Butaca tapizada moderna', profile: 'sofa', style: 'Contemporáneo',
    params: { style: 'moderno', seats: 1, arm_w: .15 }, finishes: { tapiceria: 'boucle-crudo', patas: 'metal-negro' }, textureSize: 512,
    variants: [
      { key: 'boucle', size: '85 cm', dims: [850, 880, 800], proposal: true },
      { key: 'mostaza', size: '85 cm', dims: [850, 880, 800], finishes: { tapiceria: 'terciopelo-mostaza' } },
    ],
  },
  {
    product: 'butaca_orejero', type: 'wingback', label: 'Butaca de orejas', profile: 'sofa', style: 'Clásico',
    params: { style: 'orejero' }, finishes: { tapiceria: 'espiga-gris', patas: 'nogal' }, textureSize: 512,
    variants: [
      { key: 'gris', size: '80 cm', dims: [800, 860, 1060], proposal: true },
      { key: 'verde', size: '80 cm', dims: [800, 860, 1060], finishes: { tapiceria: 'terciopelo-verde' } },
    ],
  },
  {
    product: 'butaca_madera', type: 'armchair_wood', label: 'Butaca nórdica de madera', profile: 'sofa', style: 'Nórdico',
    finishes: { tapiceria: 'lino-arena', madera: 'roble' }, textureSize: 512,
    variants: [
      { key: 'roble', size: '68 cm', dims: [680, 780, 780], proposal: true },
      { key: 'nogal', size: '68 cm', dims: [680, 780, 780], finishes: { tapiceria: 'tejido-antracita', madera: 'nogal' } },
    ],
  },
  {
    product: 'butaca_club', type: 'armchair', label: 'Butaca club de piel', profile: 'sofa', style: 'Clásico',
    params: { style: 'club', seats: 1 }, finishes: { tapiceria: 'piel-marron', patas: 'nogal' }, textureSize: 512,
    variants: [
      { key: 'marron', size: '90 cm', dims: [900, 900, 760], proposal: true },
      { key: 'conac', size: '90 cm', dims: [900, 900, 760], finishes: { tapiceria: 'piel-conac' } },
    ],
  },
  {
    product: 'butaca_envolvente', type: 'armchair_round', label: 'Butaca envolvente redondeada', profile: 'sofa', style: 'Contemporáneo',
    params: { style: 'moderno' }, finishes: { tapiceria: 'boucle-crudo', patas: 'metal-negro' }, textureSize: 512,
    variants: [
      { key: 'boucle', size: '82 cm', dims: [820, 780, 740], proposal: true },
      { key: 'rosa', size: '82 cm', dims: [820, 780, 740], finishes: { tapiceria: 'terciopelo-rosa' } },
    ],
  },
  {
    product: 'puf', type: 'pouf', label: 'Puf tapizado', profile: 'bench', style: 'Contemporáneo',
    finishes: { tapiceria: 'boucle-crudo', patas: 'nogal' }, textureSize: 512,
    variants: [
      { key: 'redondo', size: 'Redondo · Ø 50 cm', dims: [500, 500, 420], params: { shape: 'redondo' }, proposal: true },
      { key: 'redondo_verde', size: 'Redondo · Ø 50 cm', dims: [500, 500, 420], params: { shape: 'redondo' }, finishes: { tapiceria: 'terciopelo-verde' } },
      { key: 'cuadrado', size: 'Cuadrado · 60 cm', dims: [600, 600, 420], params: { shape: 'cuadrado' }, finishes: { tapiceria: 'piel-conac' } },
    ],
  },
];
