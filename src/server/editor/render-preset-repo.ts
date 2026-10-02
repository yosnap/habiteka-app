import 'server-only';
import { prisma } from '@/server/db/prisma';
import type { OrgContext } from '@/server/auth/org-context';
import { readRenderPresets, renderPresetSchema, transferableRenderOptions } from '@/lib/editor-document/render-design-presets';
import { fail } from '@/server/errors/run-action';

const FIELD = 'habitekaRenderPresets';
function metadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* Conservar los metadatos que no podemos interpretar. */ }
  return fail('Los metadatos de la organización no permiten guardar configuraciones.');
}
export async function listRenderPresets(ctx: OrgContext) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { metadata: true } });
  return readRenderPresets(JSON.stringify(metadata(org.metadata)[FIELD] ?? []));
}
export async function mutateRenderPreset(ctx: OrgContext, input: unknown, remove = false) {
  const name = renderPresetSchema.shape.name.parse(remove ? input : (input as { name?: unknown })?.name);
  const parsed = remove ? null : renderPresetSchema.parse(input);
  const preset = parsed ? { ...parsed, options: transferableRenderOptions(parsed.options) } : null;
  // Comparación optimista: conservar otros metadatos y los guardados concurrentes.
  for (let attempt = 0; attempt < 3; attempt++) {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { metadata: true } });
    const value = metadata(org.metadata);
    const previous = readRenderPresets(JSON.stringify(value[FIELD] ?? []));
    const rest = previous.filter((item) => item.name !== name);
    const next = preset ? [preset, ...rest].slice(0, 10) : rest;
    const result = await prisma.organization.updateMany({ where: { id: ctx.organizationId, metadata: org.metadata },
      data: { metadata: JSON.stringify({ ...value, [FIELD]: next }) } });
    if (result.count === 1) return next;
  }
  return fail('Otra persona está actualizando las configuraciones. Vuelve a guardar.');
}
