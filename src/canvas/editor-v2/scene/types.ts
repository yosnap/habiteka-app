import type { FloorFinish, Point } from '@/lib/editor-document/schema';
export type Vector3Tuple = [number, number, number];
export interface SceneBox {
  id: string; sourceEntityId: string; role: 'wall' | 'frame' | 'leaf' | 'glass' | 'step' | 'landing' | 'rail' | 'ramp' | 'furniture' | 'column';
  position: Vector3Tuple; size: Vector3Tuple; rotation: number; color: string;
  sideColors?: [string, string];
  sideMaterials?: [string, string];
  textureOffset?: [number, number];
  topColor?: string;
}
export interface ScenePolygon {
  id: string; sourceEntityId: string; role: 'floor' | 'junction' | 'wall';
  points: Point[]; elevation: number; height: number; color: string;
  topColor?: string;
  edgeFinishes?: { color: string; sourceEntityId: string; materialId?: string; offsetX?: number; spanX?: number }[];
  holes?: Point[][];
  floorFinish?: FloorFinish;
  sideColor?: string;
}
export interface SceneRamp {
  id: string; sourceEntityId: string; position: Vector3Tuple; width: number; depth: number; rise: number;
  /** Vertical solid body below the surface, measured from position.y. */
  baseHeight: number;
  rotation: number; color: string;
}
export interface ExteriorWall { sourceEntityId: string; x: number; z: number; normalX: number; normalZ: number }
export interface EditorScene { boxes: SceneBox[]; ramps: SceneRamp[]; polygons: ScenePolygon[]; warnings: string[]; exteriorWalls: ExteriorWall[] }
export const materialColor = (id: string) => ({ 'plaster-white': '#eeeae2', 'oak-natural': '#b58b59',
  'concrete-grey': '#a6a6a0', 'brick-red': '#a86652', 'paint-sage': '#9baa98',
  'wood-oak': '#b58b59', 'steel-dark': '#3f484d' })[id] ?? '#dedbd3';
export const meters = (mm: number) => mm / 1000;
