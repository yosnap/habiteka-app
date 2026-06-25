/**
 * Estilos decorativos de sala para el paso 3 del Smart Wizard.
 * Cada estilo es una referencia visual (imagen de interiores) que se asocia a
 * un conjunto de parámetros de color/mood. Las imágenes reales irán en
 * public/styles/<id>.jpg cuando estén disponibles; hasta entonces se usan
 * degradados CSS como placeholder.
 */
import type { RoomType } from './room-types';

export interface RoomStyle {
  id: string;
  label: string;
  /** URL de imagen de preview del estilo (foto de interiores). */
  imageUrl: string;
  /** Par de colores fallback si la imagen no carga. */
  gradient: [string, string];
  /** Tags que se pasarán al autofurnish cuando el catálogo soporte filtrado por estilo. */
  tags: string[];
}

// Imágenes de interiores de Unsplash (CC0 / free-to-use).
// Si alguna falla por cambio de ID, el tile muestra el degradado CSS como fallback.
const STYLES: Record<RoomType, RoomStyle[]> = {
  salon: [
    { id: 'salon_modern',     label: 'Moderno',    imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=120&h=60&fit=crop&q=70', gradient: ['#dce8f0', '#a8c4d8'], tags: ['modern'] },
    { id: 'salon_nordic',     label: 'Nórdico',    imageUrl: 'https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=120&h=60&fit=crop&q=70', gradient: ['#f4efe4', '#d6c8a8'], tags: ['nordic'] },
    { id: 'salon_bohemian',   label: 'Bohemio',    imageUrl: 'https://images.unsplash.com/photo-1522444195799-478538b28823?w=120&h=60&fit=crop&q=70', gradient: ['#f0e4d4', '#c89060'], tags: ['bohemian'] },
    { id: 'salon_industrial', label: 'Industrial', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=120&h=60&fit=crop&q=70', gradient: ['#d0ccc4', '#7a7060'], tags: ['industrial'] },
  ],
  dormitorio: [
    { id: 'dorm_modern',    label: 'Moderno',     imageUrl: 'https://images.unsplash.com/photo-1616046229478-9901bacd6fec?w=120&h=60&fit=crop&q=70', gradient: ['#e4e8f0', '#9aaecc'], tags: ['modern'] },
    { id: 'dorm_romantic',  label: 'Romántico',   imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=120&h=60&fit=crop&q=70', gradient: ['#f0dce4', '#d4889c'], tags: ['romantic'] },
    { id: 'dorm_minimal',   label: 'Minimalista', imageUrl: 'https://images.unsplash.com/photo-1588854337115-1c67d9247e4d?w=120&h=60&fit=crop&q=70', gradient: ['#f0f0ec', '#c8c4b8'], tags: ['minimal'] },
    { id: 'dorm_rustic',    label: 'Rústico',     imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=60&fit=crop&q=70', gradient: ['#e8dcc8', '#b09060'], tags: ['rustic'] },
  ],
  cocina: [
    { id: 'cocina_modern',   label: 'Moderna',     imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=120&h=60&fit=crop&q=70', gradient: ['#e4eef4', '#94b8cc'], tags: ['modern'] },
    { id: 'cocina_rustic',   label: 'Rústica',     imageUrl: 'https://images.unsplash.com/photo-1556909172-8c8ebbcf0099?w=120&h=60&fit=crop&q=70', gradient: ['#ece4d4', '#b89060'], tags: ['rustic'] },
    { id: 'cocina_minimal',  label: 'Minimalista', imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=120&h=60&fit=crop&q=70', gradient: ['#f4f2ee', '#c8c0b0'], tags: ['minimal'] },
    { id: 'cocina_industria',label: 'Industrial',  imageUrl: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=120&h=60&fit=crop&q=70', gradient: ['#d4d0c8', '#807060'], tags: ['industrial'] },
  ],
  bano: [
    { id: 'bano_modern',  label: 'Moderno',  imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=120&h=60&fit=crop&q=70', gradient: ['#dcecf4', '#8ab8cc'], tags: ['modern'] },
    { id: 'bano_spa',     label: 'Spa',      imageUrl: 'https://images.unsplash.com/photo-1552321554-174edb1af0eb?w=120&h=60&fit=crop&q=70', gradient: ['#d8e8d8', '#88a880'], tags: ['spa'] },
    { id: 'bano_classic', label: 'Clásico',  imageUrl: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=120&h=60&fit=crop&q=70', gradient: ['#f0eae0', '#c0a880'], tags: ['classic'] },
    { id: 'bano_minimal', label: 'Minimal',  imageUrl: 'https://images.unsplash.com/photo-1595731583693-86f3ec4abf5c?w=120&h=60&fit=crop&q=70', gradient: ['#f0f0ec', '#c0beb8'], tags: ['minimal'] },
  ],
};

export function getStylesForType(type: RoomType): RoomStyle[] {
  return STYLES[type] ?? STYLES.salon;
}
