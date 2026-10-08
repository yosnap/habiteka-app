/**
 * Formato de un proyecto exportado (`.habiteka`): un ZIP con `manifest.json` y
 * los archivos del almacenamiento en `assets/<key>`. Solo datos del proyecto:
 * sin chat del asistente, costes IA, votaciones ni marketplace.
 */
export const PROJECT_TRANSFER_FORMAT = 'habiteka-project';
export const PROJECT_TRANSFER_VERSION = 1;

type Json = unknown;

export interface TransferProject { id: string; title: string; studioState: Json | null }
export interface TransferZone { id: string; name: string; kind: string | null; order: number }
export interface TransferCanvasState { id: string; zoneId: string | null; data: Json; version: number }
export interface TransferSourceImage {
  id: string; zoneId: string | null; key: string; mime: string; width: number | null; height: number | null;
  role: string; faceBlurred: boolean; createdAt: string;
}
export interface TransferDeliverable {
  id: string; zoneId: string | null; sourceImageId: string | null; type: string; payload: Json;
  legalSeal: string; version: number; createdAt: string;
}
export interface TransferIteration { id: string; deliverableId: string; zone: Json; instruction: string; resultRef: string | null; createdAt: string }
export interface TransferEditorRevision { id: string; revision: number; document: Json; requestKey: string | null; fingerprint: string; createdAt: string }
export interface TransferEditorApproval {
  id: string; revisionId: string; fingerprint: string; assets: Json; lightingPreset: string; approvedAt: string;
}
export interface TransferEditorState {
  id: string; zoneId: string | null; headRevision: number; writable: boolean; legacySnapshot: Json; legacyFingerprint: string;
  revisions: TransferEditorRevision[]; approvals: TransferEditorApproval[];
}

export interface ProjectTransferManifest {
  format: typeof PROJECT_TRANSFER_FORMAT;
  version: typeof PROJECT_TRANSFER_VERSION;
  exportedAt: string;
  appVersion: string;
  source: { organizationId: string; projectId: string };
  project: TransferProject;
  zones: TransferZone[];
  canvasStates: TransferCanvasState[];
  sourceImages: TransferSourceImage[];
  deliverables: TransferDeliverable[];
  iterations: TransferIteration[];
  editorStates: TransferEditorState[];
  /** Keys del almacenamiento incluidas en `assets/`. */
  assets: string[];
}

/** Prefijos de las keys propias del almacenamiento de Habiteka. */
const STORAGE_KEY = /^(studio|renders|videos|media|geographic-sites|source-images|imports)\/[^\s?#]+$/;

export function isStorageKey(value: string): boolean {
  return STORAGE_KEY.test(value) && !value.includes('..');
}

/** Todas las keys del almacenamiento que aparecen en cualquier dato del proyecto. */
export function collectStorageKeys(manifest: Omit<ProjectTransferManifest, 'assets'>): string[] {
  const keys = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === 'string') { if (isStorageKey(value)) keys.add(value); return; }
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk([manifest.project, manifest.zones, manifest.canvasStates, manifest.sourceImages, manifest.deliverables,
    manifest.iterations, manifest.editorStates]);
  return [...keys].sort();
}

/** Valida la forma mínima de un manifiesto leído de un archivo. */
export function assertTransferManifest(value: unknown): asserts value is ProjectTransferManifest {
  const manifest = value as Partial<ProjectTransferManifest> | null;
  if (!manifest || manifest.format !== PROJECT_TRANSFER_FORMAT) throw new Error('El archivo no es un proyecto de Habiteka.');
  if (manifest.version !== PROJECT_TRANSFER_VERSION) throw new Error('Este proyecto se exportó con una versión de Habiteka que esta instalación no admite.');
  const lists = ['zones', 'canvasStates', 'sourceImages', 'deliverables', 'iterations', 'editorStates', 'assets'] as const;
  if (!manifest.project?.id || typeof manifest.project.title !== 'string' || !manifest.source?.projectId || !manifest.source.organizationId
    || lists.some((name) => !Array.isArray(manifest[name])))
    throw new Error('El archivo del proyecto está incompleto.');
  if (manifest.assets!.some((key) => typeof key !== 'string' || !isStorageKey(key)))
    throw new Error('El archivo del proyecto contiene rutas de archivo no válidas.');
}
