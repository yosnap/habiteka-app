/**
 * Mi perfil › Modelos de IA: qué modelo usa cada función de la organización. Se parte de la recomendación del panel
 * de admin; la organización puede elegir los suyos entre los habilitados y volver a la recomendación cuando quiera.
 */
import { Clapperboard } from 'lucide-react';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { listOrganizationModelUses } from '@/server/settings/organization-model-ops';
import { canManageAiKeys } from '@/server/settings/organization-ai-keys';
import { MODEL_USE_GUIDE, VIDEO_MODEL_GUIDE } from '@/lib/ai-model-guide';
import { Card } from '@/components/ui/card';
import { ProfileSection } from '@/components/profile/profile-section';
import { ModelUsesPanel } from '@/components/profile/model-uses-panel';

export const metadata = { title: 'Modelos de IA — Habiteka' };

export default async function ModelUsesPage() {
  const ctx = await requireOrgContext();
  const uses = await listOrganizationModelUses(ctx);
  const canEdit = canManageAiKeys(ctx);
  return (
    <ProfileSection title="Modelos de IA" description="Cada función usa los modelos recomendados por Habiteka hasta que elijas los tuyos. Puedes elegir entre los modelos habilitados, con su precio, y necesitas la clave de su proveedor. Si cambia la recomendación, solo afecta a los usos que no hayas personalizado.">
      {!canEdit ? <p className="bg-muted text-ink-soft rounded-card border border-line p-3 text-sm">Solo el propietario o un administrador de la organización puede cambiar los modelos.</p> : null}
      <ModelUsesPanel uses={uses} guide={MODEL_USE_GUIDE} canEdit={canEdit} />
      <Card className="p-5">
        <h3 className="text-ink flex items-center gap-2 text-base font-semibold"><Clapperboard size={16} aria-hidden />Vídeos</h3>
        <p className="text-ink-soft mt-1 text-sm">Habiteka usa un modelo fijo para cada tipo de vídeo, con tu clave de KIE:</p>
        <ul className="divide-line mt-3 divide-y">
          {VIDEO_MODEL_GUIDE.map((video) => (
            <li key={video.label} className="py-2.5">
              <p className="text-ink text-sm font-medium">{video.label}: <span className="text-brand-700">{video.model}</span></p>
              <p className="text-ink-soft text-xs">{video.advice}</p>
            </li>
          ))}
        </ul>
      </Card>
    </ProfileSection>
  );
}
