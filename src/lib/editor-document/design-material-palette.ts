import { buildingDocuments } from './building-levels';
import type { EditorDocument } from './schema';

/** Materiales ya guardados en las superficies del inmueble, ordenados por uso. */
export function designMaterialPalette(doc: EditorDocument) {
  const counts = {
    walls: new Map<string, number>(), floors: new Map<string, number>(), slabUndersides: new Map<string, number>(),
    stairs: new Map<string, number>(), stairBodies: new Map<string, number>(), ramps: new Map<string, number>(), rampBodies: new Map<string, number>(),
    landingBodies: new Map<string, number>(),
    columns: new Map<string, number>(),
  };
  const add = (group: keyof typeof counts, id: string) => {
    counts[group].set(id, (counts[group].get(id) ?? 0) + 1);
  };
  for (const { document } of buildingDocuments(doc)) {
    for (const wall of document.walls) {
      if (wall.hidden || !wall.materials) continue;
      add('walls', wall.materials.left);
      add('walls', wall.materials.right);
    }
    for (const floor of document.floorFinishes ?? []) {
      add('floors', floor.texture);
      if ((floor.elevationMm ?? 0) > 0 && floor.undersideTexture && floor.undersideTexture !== 'none')
        add('slabUndersides', floor.undersideTexture);
    }
    for (const zone of document.designZones ?? []) if (zone.floorFinish) add('floors', zone.floorFinish.texture);
    for (const stair of document.stairs ?? []) {
      add('stairs', stair.materialId);
      if (stair.bodyMaterialId) add('stairBodies', stair.bodyMaterialId);
    }
    for (const ramp of document.ramps ?? []) {
      add('ramps', ramp.materialId);
      if (ramp.bodyMaterialId) add(ramp.catalogId === 'builtin:ramp-landing' ? 'landingBodies' : 'rampBodies', ramp.bodyMaterialId);
    }
    for (const column of document.columns ?? []) add('columns', column.materialId);
  }
  const ranked = (group: keyof typeof counts) => [...counts[group]]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8).map(([id]) => id);
  return {
    walls: ranked('walls'), floors: ranked('floors'), slabUndersides: ranked('slabUndersides'), stairs: ranked('stairs'),
    stairBodies: ranked('stairBodies'),
    ramps: ranked('ramps'), rampBodies: ranked('rampBodies'), landingBodies: ranked('landingBodies'), columns: ranked('columns'),
  };
}
