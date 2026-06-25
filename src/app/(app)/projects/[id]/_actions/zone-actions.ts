'use server';

/**
 * Server Actions de zonas (multi-zona). Finas: resuelven la organización de la
 * sesión, validan la pertenencia del proyecto (anti-IDOR) y delegan en el repo con
 * ámbito. Incluyen el estilo por zona, que se persiste como override en el estado
 * del agente (`collected.zoneOverrides`) escrito desde el editor del plano, no
 * desde el chat (el chat fija el estilo global del inmueble).
 */
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import type { OrgContext } from '@/server/auth/org-context';
import { withOrg, type ZoneRow } from '@/server/db/scoped-repo';
import { loadState, saveState } from '@/server/agent/persistence/state-repo';
import { setZoneOverride } from '@/lib/zone-style';
import { isValidEstilo } from '@/lib/design-options';
import { isValidZoneKind } from '@/lib/zone-kinds';
import type { Estilo } from '@/lib/contracts';

/** Invalida la caché de la página del proyecto para que la lista de zonas se refresque sin recargar. */
function revalidateProject(projectId: string): void {
  revalidatePath(`/projects/${projectId}`);
}

async function assertProjectInOrg(ctx: OrgContext, projectId: string): Promise<void> {
  const project = await withOrg(ctx).projects.findById(projectId);
  if (!project) throw new Error('Proyecto no encontrado en tu organización');
}

/** Lista las zonas de un proyecto (las más recientes/ordenadas primero). */
export async function listZones(projectId: string): Promise<ZoneRow[]> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  return withOrg(ctx).zones.list(projectId);
}

/** Crea una zona en el proyecto. El nombre se acota; el orden por defecto al final. */
export async function createZone(projectId: string, name: string): Promise<ZoneRow> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const clean = String(name ?? '').trim().slice(0, 80);
  if (!clean) throw new Error('La zona necesita un nombre');
  const existing = await withOrg(ctx).zones.list(projectId);
  const zone = await withOrg(ctx).zones.create(projectId, { name: clean, order: existing.length });
  revalidateProject(projectId);
  return zone;
}

/** Comprueba que la zona pertenece al proyecto (integridad intra-org). */
async function assertZoneInProject(
  ctx: OrgContext,
  projectId: string,
  zoneId: string,
): Promise<void> {
  const zones = await withOrg(ctx).zones.list(projectId);
  if (!zones.some((z) => z.id === zoneId)) {
    throw new Error('Zona no encontrada en el proyecto');
  }
}

/**
 * Fija el TIPO de una zona (interior/exterior, vocabulario controlado). Determina la
 * variante del prompt del render por foto (img2img): un interior y una fachada/jardín
 * se describen distinto. Pasar '' limpia el tipo (vuelve a interior por defecto).
 */
export async function setZoneKind(
  projectId: string,
  zoneId: string,
  kind: string,
): Promise<void> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await assertZoneInProject(ctx, projectId, zoneId);
  const clean = String(kind ?? '').trim();
  // Solo se acepta un valor del vocabulario o '' (limpiar). Un valor libre no llega
  // al render (que asume valores normalizados) ni a la BD.
  if (clean !== '' && !isValidZoneKind(clean)) throw new Error('Tipo de zona no válido');
  // El repo no distingue '' de no-tocar: para "limpiar" se guarda 'interior' (default
  // semántico) en vez de dejar un kind huérfano; ambos producen un render interior.
  await withOrg(ctx).zones.update(projectId, zoneId, { kind: clean === '' ? 'interior' : clean });
  revalidateProject(projectId);
}

/** Renombra una zona del proyecto (validada por proyecto+org en el repo). */
export async function renameZone(projectId: string, zoneId: string, name: string): Promise<void> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const clean = String(name ?? '').trim().slice(0, 80);
  if (!clean) throw new Error('La zona necesita un nombre');
  await withOrg(ctx).zones.update(projectId, zoneId, { name: clean });
  revalidateProject(projectId);
}

/**
 * Borra una zona del proyecto en SOFT (marca `deletedAt`): desaparece de la lista pero es
 * recuperable desde la papelera, con su plano e imágenes intactos. El override de estilo se
 * conserva (para restaurar con su estilo); se limpia solo al borrar definitivamente (`purgeZone`).
 */
export async function deleteZone(projectId: string, zoneId: string): Promise<void> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await withOrg(ctx).zones.remove(projectId, zoneId);
  revalidateProject(projectId);
}

/** Lista las zonas borradas (papelera) del proyecto. */
export async function listDeletedZones(projectId: string): Promise<ZoneRow[]> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  return withOrg(ctx).zones.listDeleted(projectId);
}

/** Restaura una zona borrada (vuelve a la lista con su contenido). */
export async function restoreZone(projectId: string, zoneId: string): Promise<void> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await withOrg(ctx).zones.restore(projectId, zoneId);
  revalidateProject(projectId);
}

/**
 * Borra DEFINITIVAMENTE una zona de la papelera (hard-delete: arrastra su plano por Cascade) y
 * limpia su override de estilo en el estado del agente (no deja residuo en el JSONB).
 */
export async function purgeZone(projectId: string, zoneId: string): Promise<void> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  await withOrg(ctx).zones.purge(projectId, zoneId);
  // Limpia el override huérfano (pasar {} elimina la entrada de esa zona). Los overrides de
  // estilo por zona viven en el estado por DEFECTO del proyecto (zoneId null), no en el de
  // cada zona.
  const state = await loadState(projectId, null);
  const nextCollected = setZoneOverride(state.collected, zoneId, {});
  await saveState(projectId, null, state.version, { phase: state.phase, collected: nextCollected });
  revalidateProject(projectId);
}

/**
 * Fija (o limpia) el estilo de una zona como override del estado del agente. Pasar
 * `estilo` undefined/'' limpia el override → la zona vuelve a heredar el estilo
 * global. Preserva la fase del agente y usa el lock optimista del estado.
 */
export async function setZoneStyle(
  projectId: string,
  zoneId: string,
  estilo: Estilo | '',
): Promise<void> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  // Integridad intra-org: la zona debe ser de ESTE proyecto (evita override huérfano).
  await assertZoneInProject(ctx, projectId, zoneId);
  // Validación en el boundary: un estilo no vacío debe ser válido.
  if (estilo !== '' && !isValidEstilo(estilo)) throw new Error('Estilo no válido');

  const state = await loadState(projectId, null);
  const nextCollected = setZoneOverride(state.collected, zoneId, {
    estilo: estilo === '' ? undefined : estilo,
  });
  await saveState(projectId, null, state.version, { phase: state.phase, collected: nextCollected });
}
