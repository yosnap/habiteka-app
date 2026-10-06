import type { Opening } from './schema';
import { openingType, type OpeningType } from './opening-types';
import type { DoorHandle, FrameFinish, LeafDesign, LeafFinish } from './opening-look-options';

/** Qué partes del aspecto tienen sentido en cada tipo: una puerta de vidrio no tiene acabado de madera ni la seccional cuarterones. */
export interface OpeningLookControls { design: boolean; finish: boolean; handle: boolean; frameFinish: boolean }

const DESIGNABLE: readonly OpeningType['operation'][] = ['abatible', 'corredera', 'corredera-empotrada', 'plegable'];

export function openingLookControls(type: OpeningType | null): OpeningLookControls {
  if (!type) return { design: false, finish: false, handle: false, frameFinish: false };
  const door = type.kind === 'puerta', design = door && !type.frameless && DESIGNABLE.includes(type.operation);
  return { design, finish: door && !type.frameless && type.operation !== 'corredera-marco', handle: design || (door && !!type.frameless),
    frameFinish: !door || type.operation === 'corredera-marco' };
}

/** Aspecto efectivo de una puerta o ventana, con los valores que faltan resueltos. */
export interface OpeningLook {
  design: LeafDesign;
  /** `null`: la hoja (y el marco de la puerta) usan `colors`, como siempre. */
  finish: LeafFinish | null;
  handle: DoorHandle;
  /** `null`: el marco usa `colors.frame`, como siempre. */
  frameFinish: FrameFinish | null;
  /** Tapajuntas, mirilla y herrajes propios del tipo: el documento eligió su aspecto o el tipo es posterior a los históricos. */
  detailed: boolean;
}

/**
 * El diseño y el tirador que faltan se toman del tipo. Los tipos históricos, sin campos de aspecto, se resuelven a su
 * hoja de siempre (lisa o vidriera), sin tirador: así los documentos existentes se ven exactamente igual que antes. Sin
 * acabado elegido, hoja y marco llevan el color de Pintar (`colors`): el acabado del tipo se escribe al colocarlo.
 */
export function openingLook(opening: Pick<Opening, 'kind' | 'catalogId' | 'leafDesign' | 'leafFinish' | 'handle' | 'frameFinish'>): OpeningLook {
  const type = openingType(opening), controls = openingLookControls(type);
  const legacy = !type || !!type.legacy, look = legacy ? {} : type.look;
  const historicDesign: LeafDesign = type?.glazed ? 'vidrio' : 'lisa';
  return {
    design: (controls.design ? opening.leafDesign : undefined) ?? look.design ?? historicDesign,
    finish: (controls.finish ? opening.leafFinish : undefined) ?? null,
    handle: (controls.handle ? opening.handle : undefined) ?? look.handle ?? 'ninguno',
    frameFinish: (controls.frameFinish ? opening.frameFinish : undefined) ?? null,
    detailed: !legacy || [opening.leafDesign, opening.leafFinish, opening.handle].some((value) => value !== undefined),
  };
}

/** Campos de aspecto con los que se coloca un tipo desde el catálogo: los que el tipo admite y define. */
export function openingTypeLookPatch(type: OpeningType): Pick<Opening, 'leafDesign' | 'leafFinish' | 'handle' | 'frameFinish'> {
  const controls = openingLookControls(type), { design, finish, handle, frameFinish } = type.look;
  return { ...(controls.design && design ? { leafDesign: design } : {}), ...(controls.finish && finish ? { leafFinish: finish } : {}),
    ...(controls.handle && handle ? { handle } : {}), ...(controls.frameFinish && frameFinish ? { frameFinish } : {}) };
}

/**
 * Color y textura de cada acabado. Las maderas usan texturas CC0 de la biblioteca de materiales (`surface-materials.ts`);
 * el color multiplica la textura para templar el tono. Los lacados son color liso.
 */
export const LEAF_FINISH_APPEARANCE: Readonly<Record<LeafFinish, { color: string; materialId?: string; swatch: string }>> = {
  'lacado-blanco': { color: '#f1efea', swatch: '#f1efea' },
  roble: { color: '#f4dfbf', materialId: 'polyhaven:kitchen_wood', swatch: '#b38b5d' },
  nogal: { color: '#ffffff', materialId: 'ambientcg:Wood049', swatch: '#6e4c34' },
  antracita: { color: '#3b3f43', swatch: '#3b3f43' },
  negro: { color: '#1e1f21', swatch: '#1e1f21' },
};

export const FRAME_FINISH_APPEARANCE: Readonly<Record<FrameFinish, { color: string; materialId?: string; metal?: boolean }>> = {
  'pvc-blanco': { color: '#f4f1e9' },
  'aluminio-antracita': { color: '#3d4145', metal: true },
  madera: { color: '#f4dfbf', materialId: 'polyhaven:kitchen_wood' },
};
