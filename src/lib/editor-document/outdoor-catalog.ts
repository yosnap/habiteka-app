import type { FurnitureCatalogEntry } from './furniture-catalog';

type Row = [string, string, number, number, number, string, string, string];
const rows: Row[] = [
  ['pergola', 'Pérgola de madera', 3000, 3000, 2500, 'Madera', '#a98256', 'Sombra con cubierta de lamas'],
  ['toldo', 'Toldo de terraza', 3500, 2500, 2600, 'Lona y aluminio', '#e5d5b6', 'Sombra con brazos y lona'],
  ['sombrilla', 'Sombrilla de jardín', 2500, 2500, 2400, 'Lona y metal', '#e6d9bd', 'Sombra independiente'],
  ['puf-exterior', 'Puf de exterior', 750, 750, 450, 'Tejido exterior', '#c6a885', 'Asiento informal interior y exterior'],
  ['valla-madera', 'Valla de madera', 2000, 120, 1200, 'Madera', '#9d754c', 'Cerramiento modular de parcela'],
  ['cerca-metal', 'Cerca metálica', 2000, 100, 1500, 'Acero', '#535d59', 'Cerramiento con barrotes'],
  ['seto', 'Seto de cerramiento', 2000, 600, 1400, 'Vegetación', '#486b39', 'Cerramiento vegetal'],
  ['arbol', 'Árbol de jardín', 2500, 2500, 4000, 'Tronco y follaje', '#577d3d', 'Árbol de sombra'],
  ['arbusto', 'Arbusto', 1000, 900, 1000, 'Vegetación', '#648342', 'Vegetación baja'],
  ['planta-exterior', 'Planta de exterior', 600, 600, 1100, 'Vegetación', '#477c49', 'Planta de jardín'],
  ['maceta-exterior', 'Maceta de terracota', 500, 500, 500, 'Terracota', '#b87957', 'Recipiente para plantar'],
  ['jardinera-exterior', 'Jardinera con plantas', 1500, 450, 800, 'Madera y vegetación', '#718c4f', 'Cultivo y decoración'],
  ['huerto', 'Huerto elevado', 2400, 1200, 600, 'Madera y tierra', '#735232', 'Bancal de cultivo con hileras'],
  ['camino', 'Camino de losas', 1200, 3000, 50, 'Piedra', '#b9b3a4', 'Paso peatonal modular'],
  ['parking', 'Plaza de parking', 2500, 5000, 20, 'Asfalto', '#55595a', 'Aparcamiento con líneas de delimitación'],
  ['coche', 'Coche', 1800, 4300, 1500, 'Metal y vidrio', '#6d8a9d', 'Vehículo para escala y aparcamiento'],
  ['fuente', 'Fuente de jardín', 1400, 1400, 1300, 'Piedra y agua', '#b2ac9c', 'Fuente ornamental'],
  ['piscina', 'Piscina elevada', 6000, 3000, 1200, 'Revestimiento y agua', '#c4cec9', 'Vaso elevado con lámina de agua'],
  ['estanque', 'Estanque ornamental', 2500, 1800, 350, 'Piedra y agua', '#87988a', 'Estanque con borde de piedra'],
  ['drenaje', 'Canal de drenaje', 1000, 150, 80, 'Rejilla metálica', '#505b5b', 'Recogida de agua en suelo'],
  ['sumidero', 'Sumidero de patio', 250, 250, 40, 'Rejilla metálica', '#586462', 'Punto de drenaje'],
  ['barbacoa', 'Barbacoa con parrilla', 1400, 700, 1150, 'Acero y piedra', '#5a5c58', 'Cocinar al aire libre con encimera y parrilla'],
  ['roca', 'Roca ornamental', 1100, 800, 650, 'Piedra', '#8f8b80', 'Decoración de rocalla'],
  ['piedras', 'Grupo de piedras ornamentales', 1000, 700, 250, 'Piedra', '#b0a58e', 'Borde decorativo de jardín'],
  ['setas', 'Setas ornamentales', 450, 450, 400, 'Cerámica', '#b76044', 'Decoración de jardín'],
  ['aspersor', 'Aspersor de riego', 160, 160, 150, 'Plástico y metal', '#425a43', 'Punto de riego'],
  ['riego-goteo', 'Línea de riego por goteo', 3000, 30, 30, 'Tubo de polietileno', '#343d35', 'Distribución de riego lineal'],
  ['tira-led', 'Tira LED interior y exterior', 2000, 25, 15, 'Perfil aluminio y difusor', '#fff0c5', 'Iluminación lineal interior exterior'],
];
export const OUTDOOR_CATALOG: FurnitureCatalogEntry[] = rows.map(([kind, label, widthMm, depthMm, heightMm, material, color, purpose]) => ({
  id: `habiteka:outdoor:${kind}`, productId: `outdoor-${kind}`, variantLabel: 'Original', kind, label,
  room: kind === 'tira-led' ? 'iluminacion' : 'exterior', profile: 'outdoor', category: 'outdoor',
  function: purpose, style: 'Contemporáneo', material, color, widthMm, depthMm, heightMm, elevationMm: 0,
}));
