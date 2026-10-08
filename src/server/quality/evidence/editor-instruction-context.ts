import type { Estilo } from '@/lib/contracts';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { defaultRenderDesignOptions, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { neutralizeInstruction } from './instruction-evidence';

const safeText = (text: string, max = 100) => neutralizeInstruction(text.slice(0, max)).text;

/** Contexto acotado del documento y opciones ya validados por la acción del editor. */
export function buildEditorInstructionContext(
  document: EditorDocument,
  style: Estilo,
  objective: string,
  options: RenderDesignOptions = defaultRenderDesignOptions(),
  view?: RenderView,
) {
  const levelId = view?.levelId ?? document.activeLevelId ?? 'ground';
  const levels = buildingDocuments(document).filter(level => view?.allLevels || level.id === levelId);
  const designZone = options.designScope === 'zone'
    ? document.designZones?.find(zone => zone.id === options.designZoneId) : undefined;
  return {
    source: 'editor-document' as const,
    documentRevision: document.revision,
    style,
    objective: safeText(objective, 200),
    spaceKind: document.designSpaceKind,
    scope: {
      kind: options.designScope,
      placement: options.placement,
      ...(designZone ? { zone: { name: safeText(designZone.name), polygon: designZone.polygon } } : {}),
      regions: options.placement === 'selected'
        ? options.regions.map(region => ({ name: safeText(region.name), polygon: region.polygon })) : [],
      levels: levels.slice(0, 20).map(level => {
        const rooms = deriveRoomsSafe(level.document);
        const indoors = rooms.length > 0 && ['house', 'interior', 'exterior'].includes(options.designScope)
          ? new Set(eligibleCeilingRooms(level.document).map(room => room.id)) : null;
        const selectedRooms = rooms.filter(room => view?.roomId ? room.id === view.roomId
          : options.designScope === 'rooms' ? options.designRoomIds.includes(room.id)
          : indoors ? indoors.has(room.id) !== (options.designScope === 'exterior') : true);
        const labels = level.document.labels.filter(label => label.text.trim());
        const inSelection = (label: (typeof labels)[number]) =>
          (!designZone || pointInPolygon(label, designZone.polygon)) &&
          (options.placement !== 'selected' || options.regions.some(region => pointInPolygon(label, region.polygon)));
        return {
          name: safeText(document.levels?.find(item => item.id === level.id)?.name ?? 'Planta'),
          availableRoomNames: labels.slice(0, 40).map(label => safeText(label.text)),
          selectedRoomNames: labels.filter(label => inSelection(label) && selectedRooms.some(room => pointInPolygon(label, room.boundary)))
            .slice(0, 40).map(label => safeText(label.text)),
        };
      }),
      view: view?.preset ?? options.views,
    },
    lighting: options.lighting,
    decoration: {
      freedom: options.freedom,
      additions: [...options.additions].sort(),
      redesignFixed: options.redesignFixed,
      redesignInterior: options.redesignInterior,
    },
  };
}

export type EditorInstructionContext = ReturnType<typeof buildEditorInstructionContext>;
