/**
 * Reescritura de un proyecto exportado para importarlo en otra organización o
 * instalación: ids nuevos para todas las filas y keys nuevas para sus archivos.
 *
 * Los datos se enlazan entre sí por strings (ids de entregables dentro de jobs de
 * vídeo, keys dentro de payloads y del estudio), así que se reescribe cualquier
 * string idéntico a un id o key exportado, y los fragmentos con el proyecto u
 * organización de origen (ids compuestos como `del-<proyecto>-render3d-…`).
 */
import type { ProjectTransferManifest } from './manifest';

export interface RemapTarget {
  organizationId: string;
  projectId: string;
  /** Id nuevo para una fila; inyectable en pruebas. */
  newId: () => string;
}

export interface RemappedProject {
  manifest: ProjectTransferManifest;
  /** Key de origen → key de destino de cada archivo. */
  keys: Map<string, string>;
}

export function remapManifest(source: ProjectTransferManifest, target: RemapTarget): RemappedProject {
  const { organizationId: fromOrg, projectId: fromProject } = source.source;
  const ids = new Map<string, string>([[fromProject, target.projectId]]);
  const fresh = (id: string) => {
    if (!ids.has(id)) ids.set(id, id.includes(fromProject) ? id.split(fromProject).join(target.projectId) : target.newId());
    return ids.get(id)!;
  };
  source.zones.forEach((row) => fresh(row.id));
  source.canvasStates.forEach((row) => fresh(row.id));
  source.sourceImages.forEach((row) => fresh(row.id));
  source.deliverables.forEach((row) => fresh(row.id));
  source.iterations.forEach((row) => fresh(row.id));
  source.editorStates.forEach((state) => {
    fresh(state.id);
    state.revisions.forEach((row) => fresh(row.id));
    state.approvals.forEach((row) => fresh(row.id));
  });

  const replaceOrigin = (value: string) => value.split(fromProject).join(target.projectId).split(fromOrg).join(target.organizationId);
  // Una key con el proyecto u organización de origen conserva su estructura (hay comprobaciones de propiedad por
  // prefijo); el resto va a una carpeta del proyecto nuevo para no compartir objetos con otro proyecto.
  const keys = new Map(source.assets.map((key) => {
    let next = replaceOrigin(key);
    for (const [from, to] of ids) if (from !== fromProject && next.includes(from)) next = next.split(from).join(to);
    return [key, next !== key ? next : `imports/${target.projectId}/${key}`] as const;
  }));

  const rewrite = (value: unknown): unknown => {
    if (typeof value === 'string') return ids.get(value) ?? keys.get(value) ?? replaceOrigin(value);
    if (Array.isArray(value)) return value.map(rewrite);
    // También las claves de objeto: hay mapas indexados por id de entregable o de estancia.
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [rewrite(k) as string, rewrite(v)]));
    return value;
  };
  const manifest = rewrite(source) as ProjectTransferManifest;
  // El origen describe de dónde viene el archivo: no se reescribe.
  manifest.source = { ...source.source };
  manifest.assets = source.assets.map((key) => keys.get(key)!);
  return { manifest, keys };
}

/** Regenera las URL firmadas de los objetos con `assetKey`: las exportadas apuntan a otra instalación y caducan. */
export async function refreshAssetUrls(value: unknown, sign: (key: string) => Promise<string>): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map((item) => refreshAssetUrls(item, sign)));
  if (!value || typeof value !== 'object') return value;
  const entries = await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await refreshAssetUrls(v, sign)] as const));
  const next = Object.fromEntries(entries) as Record<string, unknown>;
  if (typeof next.assetKey === 'string' && typeof next.assetUrl === 'string') next.assetUrl = await sign(next.assetKey);
  return next;
}
