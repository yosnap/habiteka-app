import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { furnitureFacing, furnitureFront, isBed, isSofa } from './furniture-views';
import { SECTION_AXES, sectionPointVisible, sectionVisibility, type SectionSide } from './section-visibility';
import type { PieceFacing, SectionPiece } from './section-furniture-brief';

const PHRASES: Record<SectionPiece['kind'], Record<PieceFacing, string>> = {
  bed: { behind: 'cama vista por detrás, con la trasera del cabecero en primer plano y los pies hacia el fondo',
    front: 'cama vista de frente, con el cabecero al fondo', 'profile-left': 'cama de perfil, con el cabecero a la izquierda',
    'profile-right': 'cama de perfil, con el cabecero a la derecha' },
  sofa: { behind: 'sofá visto por detrás, se ve su respaldo', front: 'sofá visto de frente',
    'profile-left': 'sofá de perfil, con el respaldo a la izquierda', 'profile-right': 'sofá de perfil, con el respaldo a la derecha' },
};

/**
 * Camas y sofás cuya orientación coincide en la cenital aceptada y en el plano. El generador ignoraba «vista por detrás»
 * escrito y seguía enseñando las camas desde los pies; dibujadas en la sección, las respeta. Solo se dibujan las de las
 * estancias en que ambas fuentes coinciden: el diseño aceptado manda y puede haberse rediseñado.
 */
export function confirmedSectionFurniture(document: EditorDocument, side: SectionSide, rooms: { name: string; boundary: Point[] }[],
  read: (SectionPiece[] | null)[]): { ids: string[]; lines: string[] } {
  const axis = SECTION_AXES[side], layout = sectionVisibility(document, side), ids: string[] = [], lines: string[] = [];
  rooms.forEach((room, index) => {
    const pieces = document.furniture.filter((item) => (isBed(item) || isSofa(item)) && sectionPointVisible(layout, objectCenter(item))
      && pointInPolygon(objectCenter(item), room.boundary)).map((item) => {
      const facing = furnitureFacing(item, axis.toward), front = furnitureFront(item);
      return { id: item.id, kind: isBed(item) ? 'bed' as const : 'sofa' as const, facing: facing === 'espaldas' ? 'behind' as const
        : facing === 'frente' ? 'front' as const : axis.h(-front.x, -front.y) < 0 ? 'profile-left' as const : 'profile-right' as const };
    });
    const seen = read[index];
    if (!pieces.length || !seen || signature(pieces) !== signature(seen)) return;
    ids.push(...pieces.map((piece) => piece.id));
    lines.push(`${room.name}: ${pieces.map((piece) => PHRASES[piece.kind][piece.facing]).join(', ')}`);
  });
  return { ids, lines };
}

const signature = (pieces: SectionPiece[]) => pieces.map((piece) => `${piece.kind}:${piece.facing}`).sort().join('|');
