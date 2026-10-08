import type { FurnitureCatalogEntry } from './furniture-catalog';
import { GARDEN_PATH_MATERIALS } from './garden-path-materials';

type Row = [string, string, number, number, number, string, string, string];
const rows: Row[] = [
  ['porche-entrada', 'Porche de entrada con cuatro columnas', 3000, 2000, 2700, 'Columnas lacadas y cubierta', '#e9e7df', 'Entrada cubierta abierta, a ras o elevada con peldaños'],
  ['pergola', 'Pérgola de madera', 3000, 3000, 2500, 'Madera', '#a98256', 'Sombra con cubierta de lamas'],
  ['pergola-aluminio', 'Pérgola de aluminio', 3000, 3000, 2500, 'Aluminio', '#8f979c', 'Sombra con estructura de aluminio'],
  ['pergola-metal', 'Pérgola de acero', 3000, 3000, 2500, 'Acero lacado', '#3f484d', 'Sombra con estructura metálica'],
  ['carpa', 'Carpa con laterales transparentes', 3000, 3000, 2800, 'Lona y PVC transparente', '#e9e4d8', 'Cubierta de bar cerrada por tres lados con lona transparente'],
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
  ['coche', 'Coche compacto', 1750, 4000, 1450, 'Metal y vidrio', '#6d8a9d', 'Vehículo para escala y aparcamiento'],
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
const standardCatalog: FurnitureCatalogEntry[] = rows.map(([kind, label, widthMm, depthMm, heightMm, material, color, purpose]) => ({
  id: `habiteka:outdoor:${kind}`, productId: `outdoor-${kind}`, variantLabel: 'Original', kind, label,
  room: kind === 'tira-led' ? 'iluminacion' : 'exterior', profile: 'outdoor', category: 'outdoor',
  function: purpose, style: 'Contemporáneo', material, color, widthMm, depthMm, heightMm, elevationMm: 0,
}));
const basicCar = standardCatalog.find((entry) => entry.kind === 'coche')!;
const variants: [string, string, string, number, number, number][] = [
  ['arbusto', 'lavanda', 'Lavanda', 650, 650, 650],
  ['arbusto', 'romero', 'Romero', 700, 650, 700],
  ['planta-exterior', 'graminea', 'Gramínea ornamental', 700, 700, 1100],
  ['arbol', 'olivo', 'Olivo de jardín', 2500, 2500, 3000],
  ['arbol', 'naranjo', 'Naranjo', 2000, 2000, 2800],
  ['arbol', 'pino', 'Pino de jardín', 3200, 3200, 5000],
  ['arbol', 'cipres', 'Ciprés mediterráneo', 900, 900, 3500],
  ['arbol', 'palmera', 'Palmera de jardín', 3600, 3600, 4500],
  ['jardinera-exterior', 'terracota', 'Jardinera de terracota con formio', 1000, 400, 900],
  ['seto', 'bajo', 'Seto bajo de boj', 2000, 450, 500],
  ['seto', 'laurel', 'Seto de laurel', 2000, 700, 1800],
  ['seto', 'fotinia', 'Seto de fotinia', 2000, 650, 1400],
  ['barbacoa', 'obra', 'Barbacoa de obra', 1400, 700, 1600],
  ['aspersor', 'emergente', 'Aspersor emergente', 100, 100, 100],
  ['coche', 'suv', 'SUV', 1900, 4700, 1750],
  ['coche', 'furgoneta', 'Furgoneta', 2000, 5200, 2300],
];
export const OUTDOOR_CATALOG: FurnitureCatalogEntry[] = [...standardCatalog,
  ...Object.entries(GARDEN_PATH_MATERIALS).flatMap(([key, label]) => [false, true].map((curb) => ({
    ...standardCatalog.find((entry) => entry.kind === 'camino')!, id: `habiteka:outdoor:camino:${key}${curb ? '-bordillo' : ''}`,
    productId: `outdoor-camino-${key}${curb ? '-bordillo' : ''}`, label: `Camino de ${label.toLowerCase()}${curb ? ' con bordillos' : ''}`,
    widthMm: 3000, depthMm: 1200, variantLabel: curb ? 'Con bordillos' : 'Sin bordillos',
  }))), ...variants.map(([kind, variant, label, widthMm, depthMm, heightMm]) => ({
  ...standardCatalog.find((entry) => entry.kind === kind)!, id: `habiteka:outdoor:${kind}:${variant}`,
  productId: `outdoor-${kind}-${variant}`, variantLabel: label, label, widthMm, depthMm, heightMm,
})), {
  ...basicCar, id: 'habiteka:outdoor:coche:turismo-3d', productId: 'outdoor-coche-turismo-3d',
  variantLabel: 'Berlina', label: 'Turismo moderno', widthMm: 1800, depthMm: 4600, heightMm: 1500,
}];
