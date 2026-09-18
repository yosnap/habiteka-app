import type { WalkthroughPath } from './walkthrough';
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
  name?: string;
  /** Logical room boundary that is intentionally omitted from the 2D and 3D physical render. */
  hidden?: boolean;
  startVertexId: string;
  endVertexId: string;
  thicknessMm: number;
  dimensionalOrigin: DimensionalOrigin;
  /** Wall base level; its configured height is measured from this finished floor. */
  baseElevationMm?: number;
  heightMm?: number;
  materials?: { left: string; right: string };
  colors?: { left: string; right: string };
  /** Signed sagitta from chord midpoint along its left normal, in millimeters. */
  curveHeightMm?: number;
}
export interface Opening {
  id: string;
  name?: string;
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
  /** Opening generated when a ramp is connected to a raised floor. */
  sourceRampId?: string;
}
export interface Stair extends Point {
  id: string;
  name?: string;
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
  /** Los laterales son opcionales: una escalera puede mostrarse sin pasamanos. */
  railingLeft?: boolean;
  railingRight?: boolean;
}
/** Structural vertical support, independent from a wall's centerline. */
export interface Column extends Point {
  id: string;
  name?: string;
  catalogId: 'builtin:column-rectangular';
  widthMm: number;
  depthMm: number;
  heightMm: number;
  elevationMm: number;
  rotation: number;
  materialId: string;
  color?: string;
}
/** A continuous inclined circulation surface, measured from its lower edge. */
export interface RampRoute {
  landingMm: number;
  turn: 'left' | 'right' | 'reverse';
  secondDepthMm: number;
  secondRiseMm: number;
  landingOffset?: Point;
  secondOffset?: Point;
}
export interface Ramp extends Point {
  id: string;
  name?: string;
  catalogId: string;
  widthMm: number;
  depthMm: number;
  /** Rise of the first flight, measured from its lower edge. */
  riseMm: number;
  elevationMm: number;
  rotation: number;
  materialId: string;
  color?: string;
  /** Pasamanos por lado de circulación; se aplican a cada tramo inclinado. */
  railingLeft?: boolean;
  railingRight?: boolean;
  /** Optional second flight joined by a square landing; its rise is additive. */
  route?: RampRoute;
}
export interface Furniture extends Point {
  id: string;
  name?: string;
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
  texture: 'none' | 'wood' | 'tile' | `polyhaven:${string}` | `outdoor:${string}`;
  tileSizeMm: number;
  rotation: number;
  /** Finished floor level above the active level's base plane. */
  elevationMm?: number;
  /** Structural depth below the finished surface. Omit it to create a solid podium down to the level base. */
  slabThicknessMm?: number;
  /** Finish exposed on the underside and vertical faces of an elevated floor. */
  undersideColor?: string;
  undersideTexture?: 'none' | 'wood' | 'tile' | `polyhaven:${string}` | `outdoor:${string}`;
}
/** Superficie anclada al recinto; altura derivada de los muros y descenso explícito. */
export interface Ceiling {
  id: string;
  roomId: string;
  kind: 'plain' | 'suspended';
  dropMm: number;
  color: string;
}
/** Posición XY del centro; caída medida desde la cara inferior del techo. */
export interface Luminaire extends Point {
  id: string;
  ceilingId: string;
  kind: 'pendant' | 'flush' | 'recessed';
  dropMm: number;
  color: string;
  temperatureK: number;
  lumens: number;
  enabled: boolean;
}
/** Active level uses root collections; inactive levels retain an isolated document. */
export interface BuildingLevel {
  id: string;
  name: string;
  heightMm: number;
  document?: EditorDocument;
}
export interface EditorDocument {
  schemaVersion: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
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
  ramps?: Ramp[];
  columns?: Column[];
  comments?: ElementComment[];
  floorFinishes?: FloorFinish[];
  walkthroughs?: WalkthroughPath[];
  ceilings?: Ceiling[];
  luminaires?: Luminaire[];
  levels?: BuildingLevel[];
  activeLevelId?: string;
  /** Uso arquitectónico guardado para que los flujos IA interpreten el plano. */
  designSpaceKind?: 'interior' | 'patio' | 'terraza' | 'jardin' | 'entrada' | 'fachada';
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
