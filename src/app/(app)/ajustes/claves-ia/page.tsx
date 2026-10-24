/**
 * Ajustes › Claves de IA: cada organización añade, prueba y borra las claves de sus proveedores de IA. Las
 * generaciones usan estas claves; sin la del proveedor que pide «Modelos por uso», la función se bloquea.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { canManageAiKeys, listOrganizationAiKeys } from '@/server/settings/organization-ai-keys';
import { OrganizationAiKeysPanel } from '@/components/settings/organization-ai-keys-panel';

export const metadata = { title: 'Claves de IA — Habiteka' };

export default async function AiKeysSettingsPage() {
  const ctx = await requireOrgContext();
  const keys = await listOrganizationAiKeys(ctx);
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-ink text-2xl font-semibold tracking-tight">Claves de IA</h1>
      <p className="text-ink-soft mt-2 text-sm">
        Habiteka genera con las claves de tu organización: cada uso lo cobra tu proveedor directamente en tu cuenta.
        Añade al menos la del proveedor que usan las funciones que quieras utilizar. Las claves se guardan cifradas y
        nunca se vuelven a mostrar enteras.
      </p>
      <OrganizationAiKeysPanel
        keys={keys.map(({ updatedAt, ...key }) => ({ ...key, updatedAt: updatedAt?.toISOString() ?? null }))}
        canEdit={canManageAiKeys(ctx)}
      />
    </main>
  );
}
