import 'server-only';
import { prisma } from '@/server/db/prisma';
import { openSecret, sealSecret, secretHint } from '@/server/security/secret-box';
import { BUILT_IN_MODEL_PROVIDERS, CUSTOM_PROVIDER_PRESETS } from '@/server/ai/custom-ai-providers';
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
  /** Proveedor compatible con OpenAI de la organización (o preconfigurado, como APIMart), no uno integrado. */
  compatible: boolean;
  /** Falso en un preconfigurado que la organización aún no ha dado de alta. */
  saved: boolean;
}

/** Lo que devuelve «Probar»: la prueba no gasta tokens, solo consulta la lista de modelos o el saldo. */
export interface OrganizationAiKeyTest { ok: boolean; message: string }

// Cada proveedor publica un endpoint gratuito que exige la clave; KIE no lista modelos, pero sí consulta el saldo.
const KIE_CREDIT_URL = 'https://api.kie.ai/api/v1/chat/credit';

type ProviderEntry = { id: string; label: string; baseUrl: string; compatible: boolean; saved: boolean };

/**
 * Integrados de generación, compatibles de la organización y preconfigurados aún sin alta. Jev (TypeSafe) no está: la
 * capa de calidad la paga la plataforma.
 */
async function availableProviders(ctx: OrgContext): Promise<ProviderEntry[]> {
  const own = await prisma.aiCustomProvider.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { label: 'asc' }, select: { id: true, label: true, baseUrl: true } });
  return [
    ...Object.values(BUILT_IN_MODEL_PROVIDERS).map((item) => ({ ...item, compatible: false, saved: true })),
    ...own.map((item) => ({ ...item, compatible: true, saved: true })),
    ...CUSTOM_PROVIDER_PRESETS.filter((preset) => !own.some((item) => item.id === preset.id)).map((item) => ({ ...item, compatible: true, saved: false })),
  ];
}

async function providerOrFail(ctx: OrgContext, provider: string): Promise<ProviderEntry> {
  const found = (await availableProviders(ctx)).find((item) => item.id === provider);
  if (!found) fail('Ese proveedor no está disponible en tu organización.');
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
    availableProviders(ctx),
    prisma.organizationAiCredential.findMany({ where: { organizationId: ctx.organizationId }, select: { provider: true, keyHint: true, updatedAt: true } }),
  ]);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return providers.map(({ id, label, baseUrl, compatible, saved }) => {
    const row = byProvider.get(id);
    return { provider: id, label, baseUrl, compatible, saved, configured: !!row, keyHint: row?.keyHint ?? null, updatedAt: row?.updatedAt ?? null };
  });
}

export async function saveOrganizationAiKey(ctx: OrgContext, provider: string, rawKey: string): Promise<void> {
  assertCanManage(ctx);
  const entry = await providerOrFail(ctx, provider);
  // Un preconfigurado (APIMart) se da de alta con su URL fija al guardar su primera clave.
  if (!entry.saved) await prisma.aiCustomProvider.create({ data: { organizationId: ctx.organizationId, id: entry.id, label: entry.label, baseUrl: entry.baseUrl } });
  await sealOrganizationKey(ctx, provider, rawKey);
}

/**
 * Cifra y guarda la clave: en la base solo queda el texto cifrado y una pista de 4 caracteres. La clave en claro no
 * se guarda, no se registra y nunca vuelve al navegador.
 */
export async function sealOrganizationKey(ctx: OrgContext, provider: string, rawKey: string): Promise<void> {
  const apiKey = rawKey.trim();
  if (apiKey.length < 12 || apiKey.length > 500 || /\s/.test(apiKey)) fail('La clave parece incompleta o tiene espacios. Cópiala de nuevo desde el proveedor.');
  const sealed = { encryptedApiKey: sealSecret(apiKey), keyHint: secretHint(apiKey) };
  await prisma.organizationAiCredential.upsert({
    where: { organizationId_provider: { organizationId: ctx.organizationId, provider } },
    create: { organizationId: ctx.organizationId, provider, ...sealed },
    update: sealed,
  });
}

/** Descifra en memoria la clave de la organización para una llamada al proveedor; nunca se devuelve al cliente. */
export async function readOrganizationKey(ctx: OrgContext, provider: string): Promise<string> {
  const row = await prisma.organizationAiCredential.findUnique({
    where: { organizationId_provider: { organizationId: ctx.organizationId, provider } },
  });
  if (!row) fail('Guarda primero una clave para este proveedor.');
  try { return openSecret(row.encryptedApiKey); }
  catch { fail('No se pudo leer la clave guardada. Bórrala y vuelve a añadirla.'); }
}

export async function deleteOrganizationAiKey(ctx: OrgContext, provider: string): Promise<void> {
  assertCanManage(ctx);
  await prisma.organizationAiCredential.deleteMany({ where: { organizationId: ctx.organizationId, provider } });
}

/** Comprueba la clave guardada de la organización del contexto contra el proveedor, sin generar nada. */
export async function testOrganizationAiKey(ctx: OrgContext, provider: string): Promise<OrganizationAiKeyTest> {
  const target = await providerOrFail(ctx, provider);
  const apiKey = await readOrganizationKey(ctx, provider);
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
