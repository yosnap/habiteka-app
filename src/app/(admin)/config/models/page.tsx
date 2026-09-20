/**
 * Configuración del mapeo acción→modelo de IA. Muestra la configuración actual que
 * la capa de IA lee en runtime; la edición valida contra la allowlist y techo de
 * precio antes de persistir, e invalida la caché para aplicar el cambio sin redeploy.
 */
import { adminGetKieProviderStatus, adminGetNanProviderStatus, adminGetOpenAiProviderStatus, adminGetOpenRouterProviderStatus, adminListCustomModelProfiles, adminListModelConfig } from '@/server/admin/config/actions';
import { KieProviderForm } from '@/components/admin/kie-provider-form';
import { NanProviderForm } from '@/components/admin/nan-provider-form';
import { OpenRouterProviderForm } from '@/components/admin/openrouter-provider-form';
import { OpenAiProviderForm } from '@/components/admin/openai-provider-form';
import { AiConfigurationTabs } from '@/components/admin/ai-configuration-tabs';
import { ModelConfigForm } from '@/components/admin/model-config-form';
import { allowedModels } from '@/server/admin/config/model-allowlist';
import { MODEL_PROFILES } from '@/server/admin/config/model-profiles';
import type { ModelAction } from '@/generated/prisma/enums';

export default async function ModelsPage() {
  const [configs, kie, nan, openAi, openRouter, customProfiles] = await Promise.all([adminListModelConfig(), adminGetKieProviderStatus(), adminGetNanProviderStatus(), adminGetOpenAiProviderStatus(), adminGetOpenRouterProviderStatus(), adminListCustomModelProfiles()]);
  const actions: ModelAction[] = ['vision', 'chat', 'plano2d', 'render3d', 'inpaint', 'memoria'];
  const savedByAction = new Map(configs.map((config) => [config.action, config]));
  const options = Object.fromEntries(actions.map((action) => {
    const saved = savedByAction.get(action);
    return [action, allowedModels(action)
      .filter((model) => model.status !== 'deprecated' || (saved?.primaryModel === model.id && (saved.provider ?? 'openrouter') === model.provider) || saved?.backups.some((backup) => backup.model === model.id && backup.provider === model.provider))
      .map(({ id, label, provider, status }) => ({ id, label, provider, status }))];
  })) as Record<ModelAction, { id: string; label: string; provider: 'openrouter' | 'kie' | 'nan' | 'openai'; status: 'current' | 'legacy' | 'deprecated' }[]>;
  const initial = Object.fromEntries(configs.map((config) => [config.action, { primaryModel: config.primaryModel, provider: config.provider ?? 'openrouter', enabled: config.enabled, backups: config.backups }])) as Partial<Record<ModelAction, { primaryModel: string; provider: 'openrouter' | 'kie' | 'nan' | 'openai'; enabled: boolean; backups: { model: string; provider: 'openrouter' | 'kie' | 'nan' | 'openai' }[] }>>;
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">Modelos de IA por acción</h1>
      <AiConfigurationTabs
        providerSettings={<div className="grid gap-4 lg:grid-cols-4">
          <OpenRouterProviderForm configured={openRouter.configured} enabled={openRouter.enabled} keyHint={openRouter.keyHint} />
          <OpenAiProviderForm configured={openAi.configured} enabled={openAi.enabled} keyHint={openAi.keyHint} />
          <KieProviderForm configured={kie.configured} enabled={kie.enabled} keyHint={kie.keyHint} />
          <NanProviderForm configured={nan.configured} enabled={nan.enabled} keyHint={nan.keyHint} />
        </div>}
        modelMapping={<><ModelConfigForm actions={actions} options={options} initial={initial} profiles={[...Object.values(MODEL_PROFILES), ...customProfiles]} />
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left">
          <tr>
            <th className="py-2">Acción</th>
            <th className="py-2">Modelo primario</th>
            <th className="py-2">Respaldos</th>
            <th className="py-2">Proveedor</th>
            <th className="py-2">Activo</th>
          </tr>
        </thead>
        <tbody>
          {configs.map((c) => (
            <tr key={c.action} className="border-line border-t">
              <td className="py-2">{c.action}</td>
              <td className="py-2 font-mono text-xs">{c.primaryModel}{allowedModels(c.action).some((model) => model.id === c.primaryModel && model.status === 'deprecated') ? ' ⚠ Deprecado' : ''}</td>
              <td className="py-2 font-mono text-xs">{c.backups.map((backup) => `${backup.provider}: ${backup.model}`).join(', ') || '—'}</td>
              <td className="py-2">{c.provider ?? 'openrouter'}</td>
              <td className="py-2">{c.enabled ? 'Sí' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table></>}
      />
    </section>
  );
}
