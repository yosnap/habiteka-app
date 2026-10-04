import { OUTDOOR_CATALOG } from './outdoor-catalog';
import type { Furniture } from './schema';
import { ASSET_CATALOG } from './furniture-assets';

export type FurnitureProfile = 'outdoor' | 'sofa' | 'sofa-chaise' | 'sofa-corner' | 'sofa-modular' | 'sofa-bed' | 'bed' | 'chair' | 'table' | 'cabinet' | 'shelf' | 'kitchen' | 'sink' | 'toilet' | 'bath' | 'shower' | 'lamp' | 'plant' | 'decor' | 'rug'
  | 'curtain' | 'curtain-open' | 'roller' | 'venetian' | 'vertical-blind' | 'shutter' | 'appliance' | 'screen' | 'bench';
export type FurnitureRoom = 'salon' | 'dormitorio' | 'comedor' | 'cocina' | 'bano' | 'oficina' | 'exterior' | 'iluminacion' | 'decoracion';
export interface FurnitureCatalogEntry {
  id: string; productId: string; variantLabel: string; kind: string; label: string;
  room: FurnitureRoom; category: string; function: string; style: string; material: string;
  color: string; widthMm: number; depthMm: number; heightMm: number; elevationMm: number;
  profile: FurnitureProfile;
}
export const FURNITURE_ROOMS: Record<FurnitureRoom, string> = {
  salon: 'Salón', dormitorio: 'Dormitorio', comedor: 'Comedor', cocina: 'Cocina',
  bano: 'Baño', oficina: 'Oficina', exterior: 'Exterior', iluminacion: 'Iluminación', decoracion: 'Decoración',
};
type Dimensions = [number, number, number];
function entry(id: string, label: string, room: FurnitureRoom, profile: FurnitureProfile,
  dimensions: Dimensions, material: string, color: string, purpose: string,
  style = 'Contemporáneo', elevationMm = 0): FurnitureCatalogEntry {
  return { id: `habiteka:furniture:${id}`, productId: id, variantLabel: 'Original', kind: id,
    label, room, category: profile, function: purpose, style, material, color,
    widthMm: dimensions[0], depthMm: dimensions[1], heightMm: dimensions[2], elevationMm, profile };
}
function variant(source: FurnitureCatalogEntry, suffix: string, label: string, changes: Partial<FurnitureCatalogEntry>): FurnitureCatalogEntry {
  return { ...source, ...changes, id: `${source.id}:${suffix}`, variantLabel: label };
}
const essentials = [
  entry('sofa-2', 'Sofá de dos plazas', 'salon', 'sofa', [1800, 900, 820], 'Tela', '#b9b5aa', 'Sentarse y conversar', 'Nórdico'),
  entry('sofa-3', 'Sofá de tres plazas', 'salon', 'sofa', [2300, 950, 850], 'Tela', '#7b8b86', 'Sentarse y descansar'),
  entry('butaca', 'Butaca', 'salon', 'sofa', [850, 850, 900], 'Tela', '#bc8563', 'Lectura y descanso', 'Nórdico'),
  entry('mesa-centro', 'Mesa de centro', 'salon', 'table', [1100, 600, 420], 'Roble', '#bc9465', 'Apoyar objetos', 'Nórdico'),
  entry('mesa-auxiliar', 'Mesa auxiliar', 'salon', 'table', [450, 450, 550], 'Metal', '#59605e', 'Apoyo junto al asiento', 'Industrial'),
  entry('mueble-tv', 'Mueble de televisión', 'salon', 'cabinet', [1600, 400, 500], 'Roble', '#b99062', 'Guardar equipos audiovisuales'),
  entry('libreria', 'Librería', 'salon', 'shelf', [1000, 350, 1900], 'Roble', '#a78157', 'Organizar libros', 'Nórdico'),
  entry('televisor', 'Televisor con soporte', 'salon', 'screen', [1200, 250, 750], 'Metal y vidrio', '#353b3c', 'Entretenimiento audiovisual'),
  entry('cama-doble', 'Cama doble', 'dormitorio', 'bed', [1600, 2100, 1000], 'Tela y madera', '#cec4b6', 'Dormir dos personas', 'Nórdico'),
  entry('cama-individual', 'Cama individual', 'dormitorio', 'bed', [1000, 2000, 900], 'Madera', '#b99b73', 'Dormir una persona'),
  entry('mesita', 'Mesita de noche', 'dormitorio', 'cabinet', [450, 400, 550], 'Roble', '#b99b73', 'Apoyo y almacenaje nocturno', 'Nórdico'),
  entry('armario', 'Armario de dos puertas', 'dormitorio', 'cabinet', [1200, 600, 2200], 'Madera lacada', '#e3e0d8', 'Guardar ropa'),
  entry('comoda', 'Cómoda', 'dormitorio', 'cabinet', [1000, 450, 850], 'Roble', '#b79164', 'Organizar ropa doblada'),
  entry('banco-pie-cama', 'Banco de dormitorio', 'dormitorio', 'bench', [1200, 400, 450], 'Tela y madera', '#a39a8e', 'Sentarse al vestirse'),
  entry('mesa-comedor', 'Mesa de comedor', 'comedor', 'table', [1600, 900, 750], 'Roble', '#b89364', 'Comer y reunirse', 'Nórdico'),
  entry('mesa-cocina', 'Mesa de cocina', 'comedor', 'table', [1200, 800, 750], 'Roble', '#c2a27a', 'Comer a diario en la cocina, cuatro plazas', 'Nórdico'),
  entry('silla-comedor', 'Silla de comedor', 'comedor', 'chair', [480, 520, 850], 'Madera', '#b89364', 'Sentarse a la mesa', 'Nórdico'),
  entry('aparador', 'Aparador', 'comedor', 'cabinet', [1500, 450, 850], 'Nogal', '#85684f', 'Guardar vajilla', 'Clásico'),
  entry('vitrina', 'Vitrina', 'comedor', 'shelf', [900, 400, 1800], 'Metal y vidrio', '#6d7775', 'Exponer vajilla'),
  entry('banco-comedor', 'Banco de comedor', 'comedor', 'bench', [1400, 400, 450], 'Roble', '#ae885c', 'Asiento compartido', 'Rústico'),
  entry('mueble-cocina', 'Módulo bajo de cocina', 'cocina', 'kitchen', [600, 600, 900], 'Madera y piedra', '#c8c7bf', 'Preparar alimentos y almacenar'),
  entry('isla-cocina', 'Isla de cocina', 'cocina', 'kitchen', [1800, 900, 900], 'Madera y piedra', '#a6aba5', 'Preparación central de alimentos'),
  entry('fregadero', 'Fregadero con mueble', 'cocina', 'sink', [800, 600, 900], 'Acero y madera', '#b8c0bd', 'Lavar alimentos y vajilla'),
  entry('frigorifico', 'Frigorífico', 'cocina', 'appliance', [700, 700, 1900], 'Acero', '#aeb7b8', 'Conservar alimentos'),
  entry('horno', 'Horno de pie', 'cocina', 'appliance', [600, 600, 900], 'Acero', '#747f82', 'Cocinar alimentos'),
  entry('lavavajillas', 'Lavavajillas', 'cocina', 'appliance', [600, 600, 850], 'Acero', '#b1b7b8', 'Lavar vajilla'),
  entry('taburete', 'Taburete de cocina', 'cocina', 'chair', [420, 420, 1000], 'Metal y madera', '#987853', 'Sentarse en barra', 'Industrial'),
  entry('lavabo', 'Lavabo con mueble', 'bano', 'sink', [800, 500, 850], 'Cerámica y madera', '#d1d5ce', 'Aseo personal'),
  entry('inodoro', 'Inodoro', 'bano', 'toilet', [400, 700, 800], 'Cerámica', '#e4e6e2', 'Aseo sanitario'),
  entry('banera', 'Bañera', 'bano', 'bath', [1700, 750, 600], 'Cerámica', '#e2e5e0', 'Baño y descanso'),
  entry('ducha', 'Plato de ducha', 'bano', 'shower', [900, 900, 60], 'Piedra', '#c0c5c0', 'Ducha'),
  entry('columna-bano', 'Columna de baño', 'bano', 'cabinet', [350, 350, 1800], 'Madera lacada', '#d3d7d1', 'Guardar productos de aseo'),
  entry('lavadora', 'Lavadora', 'bano', 'appliance', [600, 600, 850], 'Acero esmaltado', '#d5dbd8', 'Lavar ropa'),
  entry('escritorio', 'Escritorio', 'oficina', 'table', [1400, 700, 750], 'Roble y metal', '#ad8b63', 'Trabajar y estudiar', 'Industrial'),
  entry('silla-oficina', 'Silla de oficina', 'oficina', 'chair', [650, 650, 1100], 'Malla y metal', '#525d61', 'Trabajo sentado'),
  entry('cajonera', 'Cajonera de oficina', 'oficina', 'cabinet', [420, 550, 600], 'Metal', '#8d9794', 'Archivar documentos', 'Industrial'),
  entry('estanteria-oficina', 'Estantería de oficina', 'oficina', 'shelf', [1200, 350, 1800], 'Metal y madera', '#7e8c85', 'Organizar archivos', 'Industrial'),
  entry('monitor', 'Monitor con soporte', 'oficina', 'screen', [600, 200, 450], 'Metal y vidrio', '#364047', 'Visualizar trabajo', 'Contemporáneo', 750),
  entry('mesa-jardin', 'Mesa de jardín', 'exterior', 'table', [1500, 800, 750], 'Teca', '#a67f52', 'Comer al aire libre', 'Rústico'),
  entry('silla-jardin', 'Silla de jardín', 'exterior', 'chair', [550, 600, 850], 'Teca', '#a67f52', 'Sentarse al aire libre', 'Rústico'),
  entry('banco-jardin', 'Banco de jardín', 'exterior', 'bench', [1500, 500, 450], 'Teca', '#a67f52', 'Descanso al aire libre', 'Rústico'),
  entry('sofa-exterior', 'Sofá de exterior', 'exterior', 'sofa', [1900, 850, 800], 'Ratán y tela', '#b6a88f', 'Descanso en terraza', 'Mediterráneo'),
  entry('jardinera', 'Jardinera', 'exterior', 'plant', [1000, 400, 900], 'Terracota y vegetación', '#718668', 'Vegetación exterior', 'Mediterráneo'),
  entry('lampara-pie', 'Lámpara de pie', 'iluminacion', 'lamp', [450, 450, 1600], 'Metal y tela', '#c2b59d', 'Iluminación ambiental', 'Nórdico'),
  entry('lampara-mesa', 'Lámpara de mesa', 'iluminacion', 'lamp', [300, 300, 450], 'Cerámica y tela', '#d2b896', 'Iluminación de apoyo', 'Nórdico', 550),
  entry('lampara-escritorio', 'Lámpara de escritorio', 'iluminacion', 'lamp', [250, 250, 500], 'Metal', '#4e6462', 'Iluminación de trabajo', 'Industrial', 750),
  entry('alfombra', 'Alfombra', 'decoracion', 'rug', [2000, 1500, 10], 'Lana', '#b79f83', 'Delimitar zona y aportar confort', 'Mediterráneo'),
  entry('planta', 'Planta de interior', 'decoracion', 'plant', [500, 500, 1200], 'Cerámica y vegetación', '#658661', 'Vegetación interior', 'Mediterráneo'),
  entry('cortina', 'Cortina independiente', 'decoracion', 'curtain', [1800, 180, 2400], 'Lino', '#cfc6b8', 'Filtrar luz; colocación independiente', 'Mediterráneo'),
  entry('chaise-longue', 'Sofá con chaise longue', 'salon', 'sofa-chaise', [2600, 1600, 850], 'Tela', '#9aa39e', 'Descanso con módulo alargado a la derecha'),
  entry('rinconera', 'Sofá rinconero', 'salon', 'sofa-corner', [2800, 2200, 850], 'Tela', '#b3ab9c', 'Asiento en esquina para varias personas'),
  entry('sofa-modular', 'Sofá modular de tres módulos', 'salon', 'sofa-modular', [2700, 950, 820], 'Tela', '#8b9a95', 'Módulos independientes combinables', 'Nórdico'),
  entry('sofa-cama', 'Sofá cama', 'salon', 'sofa-bed', [2000, 950, 850], 'Tela', '#a89b8a', 'Sofá que se convierte en cama'),
  entry('cortina-abierta', 'Cortina abierta (dos paños)', 'decoracion', 'curtain-open', [1800, 180, 2400], 'Lino', '#d8cfc0', 'Paños recogidos a los lados', 'Mediterráneo'),
  entry('estor-enrollable', 'Estor enrollable', 'decoracion', 'roller', [1200, 80, 1600], 'Tejido técnico', '#e4e0d6', 'Pantalla que se enrolla en un tubo', 'Contemporáneo', 900),
  entry('persiana-veneciana', 'Persiana veneciana', 'decoracion', 'venetian', [1200, 60, 1500], 'Aluminio', '#c9ccc8', 'Lamas horizontales orientables', 'Contemporáneo', 900),
  entry('persiana-vertical', 'Persiana de lamas verticales', 'decoracion', 'vertical-blind', [1800, 100, 2400], 'Tejido', '#d5d2c8', 'Lamas verticales giratorias', 'Contemporáneo'),
  entry('persiana-exterior', 'Persiana enrollable exterior', 'exterior', 'shutter', [1200, 150, 1400], 'Aluminio', '#b9bcb6', 'Cajón y lamas enrollables sobre la ventana', 'Contemporáneo', 900),
];
export const FURNITURE_CATALOG: readonly FurnitureCatalogEntry[] = [...ASSET_CATALOG, ...OUTDOOR_CATALOG, ...essentials.flatMap((item) => {
  if (item.kind === 'cama-doble') return [item, variant(item, 'king', 'King · 180 cm', { widthMm: 1800, color: '#9caaa6', material: 'Tela acolchada y madera' })];
  if (item.kind === 'sofa-3') return [item, variant(item, 'piel', 'Piel · 250 cm', { widthMm: 2500, material: 'Piel', color: '#8e5e42', style: 'Clásico' })];
  if (item.kind === 'mesa-comedor') return [item, variant(item, 'grande', 'Nogal · 200 cm', { widthMm: 2000, depthMm: 1000, material: 'Nogal', color: '#785b43', style: 'Clásico' })];
  if (item.kind === 'alfombra') return [item, variant(item, 'grande', 'Yute · 300 × 200 cm', { widthMm: 3000, depthMm: 2000, material: 'Yute', color: '#bda777', style: 'Rústico' })];
  if (item.kind === 'armario') return [item, variant(item, 'grande', 'Roble · 180 cm', { widthMm: 1800, material: 'Roble', color: '#b49267', style: 'Nórdico' })];
  if (item.kind === 'sofa-cama') return [item, variant(item, 'abierto', 'Abierto · cama 200 × 190 cm', { depthMm: 1900, heightMm: 450 })];
  if (item.kind === 'cortina' || item.kind === 'cortina-abierta') return [item, variant(item, 'gris', 'Gris piedra', { color: '#9a9a96' }), variant(item, 'azul', 'Azul noche', { color: '#6c7f93' }), variant(item, 'blanco', 'Blanco roto', { color: '#efeae0' })];
  if (item.kind === 'estor-enrollable') return [item, variant(item, 'gris', 'Gris grafito', { color: '#8f8f8b' }), variant(item, 'screen', 'Screen negro', { color: '#3a3d3c', material: 'Tejido screen' })];
  if (item.kind === 'persiana-veneciana') return [item, variant(item, 'madera', 'Madera clara', { color: '#c9a878', material: 'Madera' }), variant(item, 'negra', 'Negra', { color: '#3a3d3c' })];
  return [item];
})];
const catalogById = new Map(FURNITURE_CATALOG.map((item) => [item.id, item]));
export function getFurnitureCatalogEntry(catalogId?: string): FurnitureCatalogEntry | undefined {
  return catalogId ? catalogById.get(catalogId) : undefined;
}
export function furnitureLabel(item: Pick<Furniture, 'kind' | 'catalogId'>): string {
  return getFurnitureCatalogEntry(item.catalogId)?.label ?? item.kind.replaceAll('-', ' ');
}
export function normalizeFurnitureSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}
export function searchFurnitureCatalog(query: string, room = '', style = ''): FurnitureCatalogEntry[] {
  const terms = normalizeFurnitureSearch(query).split(/\s+/).filter(Boolean);
  return FURNITURE_CATALOG.filter((item) => (!room || item.room === room) && (!style || item.style === style)
    && terms.every((term) => normalizeFurnitureSearch([item.label, item.variantLabel, item.material,
      item.function, item.style, FURNITURE_ROOMS[item.room]].join(' ')).includes(term)));
}
