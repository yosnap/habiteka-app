/**
 * Mi perfil › Claves de IA: cada organización añade, prueba y borra las claves de sus proveedores de IA, habilita sus
 * modelos y añade proveedores compatibles. Las
 * generaciones usan estas claves; sin la del proveedor del modelo elegido, la función se bloquea.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { canManageAiKeys, listOrganizationAiKeys } from '@/server/settings/organization-ai-keys';
import { listProviderModelViews } from '@/server/settings/organization-catalog-ops';
import { OrganizationAiKeysPanel } from '@/components/settings/organization-ai-keys-panel';
import { ProfileSection } from '@/components/profile/profile-section';

export const metadata = { title: 'Claves de IA — Habiteka' };

export default async function AiKeysSettingsPage() {
  const ctx = await requireOrgContext();
  const keys = await listOrganizationAiKeys(ctx);
  const models = await listProviderModelViews(ctx, keys.filter((key) => key.saved).map((key) => key.provider));
  return (
    <ProfileSection title="Claves de IA" description="Habiteka genera con las claves de tu organización: cada uso lo cobra tu proveedor directamente en tu cuenta. En cada proveedor puedes ver sus modelos y habilitar los que quieras elegir en Modelos de IA, y puedes añadir proveedores compatibles con OpenAI. Las claves se cifran al guardarlas: nadie, tampoco Habiteka, puede volver a verlas; solo se usan para llamar a su proveedor desde las funciones que pidas.">
      <OrganizationAiKeysPanel
        keys={keys.map(({ updatedAt, ...key }) => ({ ...key, updatedAt: updatedAt?.toISOString() ?? null }))}
        canEdit={canManageAiKeys(ctx)}
        models={models}
      />
    </ProfileSection>
  );
}
