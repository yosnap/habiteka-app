export type DimensionalOrigin = 'raster' | 'physical';
export interface Point {
  x: number;
  y: number;
}
export interface Vertex extends Point {
  id: string;
}
export interface Wall {
  id: string;
  startVertexId: string;
  endVertexId: string;
  thicknessMm: number;
  dimensionalOrigin: DimensionalOrigin;
  heightMm?: number;
  materials?: { left: string; right: string };
  colors?: { left: string; right: string };
  /** Signed sagitta from chord midpoint along its left normal, in millimeters. */
  curveHeightMm?: number;
}
export interface Opening {
  id: string;
  wallId: string;
  kind: 'puerta' | 'ventana' | 'hueco';
  /** Normalized center measured from the oriented wall start. */
  position: number;
  widthMm: number;
  dimensionalOrigin: DimensionalOrigin;
  heightMm?: number;
  elevationMm?: number;
  catalogId?: string;
  /** Hinge at opening start (left) or end (right), along the oriented wall. */
  hinge?: 'left' | 'right';
  /** left = positive wall normal (-dy, dx); right = its negative. */
  swing?: 'left' | 'right';
  openAngleDeg?: number;
  colors?: { frame: string; leaf: string };
}
export interface Stair extends Point {
  id: string;
  kind: 'straight' | 'L' | 'U';
  catalogId: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  elevationMm: number;
  rotation: number;
  stepCount: number;
  materialId: string;
  color?: string;
}
export interface Furniture extends Point {
  id: string;
  kind: string;
  catalogId?: string;
  widthMm: number;
  depthMm: number;
  rotation: number;
  dimensionalOrigin: DimensionalOrigin;
  heightMm?: number;
  elevationMm?: number;
  color?: string;
}
export interface ElementComment {
  id: string;
  targetEntityId: string;
  anchor: Point;
  text: string;
}
export interface Dimension {
  id: string;
  from: Point;
  to: Point;
  label?: string;
}
export interface Label extends Point {
  id: string;
  text: string;
}
export interface FloorFinish {
  roomId: string;
  color: string;
  texture: 'none' | 'wood' | 'tile' | `polyhaven:${string}`;
  tileSizeMm: number;
  rotation: number;
}
/** Active level uses root collections; inactive levels retain an isolated document. */
export interface BuildingLevel {
  id: string;
  name: string;
  heightMm: number;
  document?: EditorDocument;
}
export interface EditorDocument {
  schemaVersion: 2 | 3 | 4 | 5;
  revision: number;
  units: 'mm';
  calibration: { mmPerPixel: number } | null;
  vertices: Vertex[];
  walls: Wall[];
  openings: Opening[];
  furniture: Furniture[];
  dimensions: Dimension[];
  labels: Label[];
  stairs?: Stair[];
  comments?: ElementComment[];
  floorFinishes?: FloorFinish[];
  levels?: BuildingLevel[];
  activeLevelId?: string;
}
export function emptyEditorDocument(): EditorDocument {
  return {
    schemaVersion: 2,
    revision: 0,
    units: 'mm',
    calibration: null,
    vertices: [],
    walls: [],
    openings: [],
    furniture: [],
    dimensions: [],
    labels: [],
  };
}
