import 'server-only';
import { prisma } from '@/server/db/prisma';
import { openSecret, sealSecret, secretHint } from '@/server/security/secret-box';
import { BUILT_IN_MODEL_PROVIDERS } from '@/server/ai/custom-ai-providers';
import { fail } from '@/server/errors/run-action';
import type { OrgContext } from '@/server/auth/org-context';

/** Proveedor al que una organización puede poner su clave, con su estado (nunca la clave). */
export interface OrganizationAiKeyView {
  provider: string;
  label: string;
  baseUrl: string;
  configured: boolean;
  keyHint: string | null;
  updatedAt: Date | null;
}

/** Lo que devuelve «Probar»: la prueba no gasta tokens, solo consulta la lista de modelos o el saldo. */
export interface OrganizationAiKeyTest { ok: boolean; message: string }

// Cada proveedor publica un endpoint gratuito que exige la clave; KIE no lista modelos, pero sí consulta el saldo.
const KIE_CREDIT_URL = 'https://api.kie.ai/api/v1/chat/credit';

/** Integrados de generación y compatibles del panel. Jev (TypeSafe) no está: la capa de calidad la paga la plataforma. */
async function availableProviders(): Promise<{ id: string; label: string; baseUrl: string }[]> {
  const custom = await prisma.aiCustomProvider.findMany({ orderBy: { label: 'asc' }, select: { id: true, label: true, baseUrl: true } });
  return [...Object.values(BUILT_IN_MODEL_PROVIDERS), ...custom];
}

async function providerOrFail(provider: string) {
  const found = (await availableProviders()).find((item) => item.id === provider);
  if (!found) fail('Ese proveedor no está disponible en Habiteka.');
  return found;
}

/** Solo el propietario o un administrador de la organización cambian sus claves; un miembro ve el estado. */
export function canManageAiKeys(ctx: Pick<OrgContext, 'role'>): boolean {
  return ctx.role === 'owner' || ctx.role === 'admin';
}

function assertCanManage(ctx: OrgContext): void {
  if (!canManageAiKeys(ctx)) fail('Solo el propietario o un administrador de la organización puede cambiar sus claves de IA.');
}

export async function listOrganizationAiKeys(ctx: OrgContext): Promise<OrganizationAiKeyView[]> {
  const [providers, rows] = await Promise.all([
    availableProviders(),
    prisma.organizationAiCredential.findMany({ where: { organizationId: ctx.organizationId }, select: { provider: true, keyHint: true, updatedAt: true } }),
  ]);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return providers.map(({ id, label, baseUrl }) => {
    const row = byProvider.get(id);
    return { provider: id, label, baseUrl, configured: !!row, keyHint: row?.keyHint ?? null, updatedAt: row?.updatedAt ?? null };
  });
}

export async function saveOrganizationAiKey(ctx: OrgContext, provider: string, rawKey: string): Promise<void> {
  assertCanManage(ctx);
  await providerOrFail(provider);
  const apiKey = rawKey.trim();
  if (apiKey.length < 12 || apiKey.length > 500 || /\s/.test(apiKey)) fail('La clave parece incompleta o tiene espacios. Cópiala de nuevo desde el proveedor.');
  const sealed = { encryptedApiKey: sealSecret(apiKey), keyHint: secretHint(apiKey) };
  await prisma.organizationAiCredential.upsert({
    where: { organizationId_provider: { organizationId: ctx.organizationId, provider } },
    create: { organizationId: ctx.organizationId, provider, ...sealed },
    update: sealed,
  });
}

export async function deleteOrganizationAiKey(ctx: OrgContext, provider: string): Promise<void> {
  assertCanManage(ctx);
  await prisma.organizationAiCredential.deleteMany({ where: { organizationId: ctx.organizationId, provider } });
}

/** Comprueba la clave guardada de la organización del contexto contra el proveedor, sin generar nada. */
export async function testOrganizationAiKey(ctx: OrgContext, provider: string): Promise<OrganizationAiKeyTest> {
  const target = await providerOrFail(provider);
  const row = await prisma.organizationAiCredential.findUnique({
    where: { organizationId_provider: { organizationId: ctx.organizationId, provider } },
  });
  if (!row) fail('Guarda primero una clave para poder probarla.');
  let apiKey: string;
  try { apiKey = openSecret(row.encryptedApiKey); }
  catch { fail('No se pudo leer la clave guardada. Bórrala y vuelve a añadirla.'); }
  const url = provider === 'kie' ? KIE_CREDIT_URL : `${target.baseUrl}/models`;
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  } catch {
    return { ok: false, message: `${target.label} no responde ahora mismo. Prueba de nuevo en un rato.` };
  }
  const body = await response.json().catch(() => null) as { code?: unknown; data?: unknown } | null;
  // KIE contesta 200 con el código de error dentro del cuerpo.
  const status = provider === 'kie' && typeof body?.code === 'number' ? body.code : response.status;
  if (status === 401 || status === 403) return { ok: false, message: `${target.label} rechaza la clave. Revisa que esté completa y activa.` };
  if (status < 200 || status >= 300) return { ok: false, message: `${target.label} ha respondido con un error (${status}). La clave puede ser válida; se comprobará en la primera generación.` };
  if (provider === 'kie' && typeof body?.data === 'number') return { ok: true, message: `Clave válida. Saldo en KIE: ${body.data} créditos.` };
  return { ok: true, message: `Clave válida: ${target.label} la ha aceptado.` };
}
