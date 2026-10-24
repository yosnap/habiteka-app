/**
 * Configuración del mapeo acción→modelo de IA. Muestra la configuración actual que
 * la capa de IA lee en runtime; la edición valida contra la allowlist y techo de
 * precio antes de persistir, e invalida la caché para aplicar el cambio sin redeploy.
 */
import { adminGetKieProviderStatus, adminGetNanProviderStatus, adminGetOpenAiProviderStatus, adminGetOpenRouterProviderStatus, adminGetTypesafeProviderStatus, adminListBuiltInModelProviders, adminListCustomModelProfiles, adminListCustomProviders, adminListModelConfig } from '@/server/admin/config/actions';
import { CustomProvidersPanel } from '@/components/admin/custom-providers-panel';
import { BuiltInModelsPanel } from '@/components/admin/provider-models';
import { CUSTOM_MODEL_ACTIONS, customProvider, loadCustomRegistry } from '@/server/ai/custom-ai-providers';
import { KieProviderForm } from '@/components/admin/kie-provider-form';
import { NanProviderForm } from '@/components/admin/nan-provider-form';
import { OpenRouterProviderForm } from '@/components/admin/openrouter-provider-form';
import { OpenAiProviderForm } from '@/components/admin/openai-provider-form';
import { TypesafeProviderForm } from '@/components/admin/typesafe-provider-form';
import { AiConfigurationTabs } from '@/components/admin/ai-configuration-tabs';
import { ModelConfigForm } from '@/components/admin/model-config-form';
import { allowedModels, PRICE_CEILING } from '@/server/admin/config/model-allowlist';
import { MODEL_PROFILES } from '@/server/admin/config/model-profiles';
import type { ModelAction } from '@/generated/prisma/enums';
import { modelAdoption } from '@/server/admin/config/model-adoption';
import { MODEL_USE_GUIDE } from '@/lib/ai-model-guide';

export default async function ModelsPage() {
  const [configs, kie, nan, openAi, openRouter, typesafe, customProfiles, customProviders, builtInModels] = await Promise.all([adminListModelConfig(), adminGetKieProviderStatus(), adminGetNanProviderStatus(), adminGetOpenAiProviderStatus(), adminGetOpenRouterProviderStatus(), adminGetTypesafeProviderStatus(), adminListCustomModelProfiles(), adminListCustomProviders(), adminListBuiltInModelProviders(), loadCustomRegistry()]);
  const adoption = await modelAdoption();
  const actions: ModelAction[] = ['vision', 'chat', 'plano2d', 'render3d', 'inpaint', 'memoria'];
  const savedByAction = new Map(configs.map((config) => [config.action, config]));
  const options = Object.fromEntries(actions.map((action) => {
    const saved = savedByAction.get(action);
    return [action, allowedModels(action)
      .filter((model) => model.status !== 'deprecated' || (saved?.primaryModel === model.id && (saved.provider ?? 'openrouter') === model.provider) || saved?.backups.some((backup) => backup.model === model.id && backup.provider === model.provider))
      .map(({ id, label, provider, status }) => ({ id, label, provider, status, group: customProvider(provider)?.label }))];
  })) as Record<ModelAction, { id: string; label: string; provider: string; status: 'current' | 'legacy' | 'deprecated'; group?: string }[]>;
  const initial = Object.fromEntries(configs.map((config) => [config.action, { primaryModel: config.primaryModel, provider: config.provider ?? 'openrouter', enabled: config.enabled, backups: config.backups }])) as Partial<Record<ModelAction, { primaryModel: string; provider: string; enabled: boolean; backups: { model: string; provider: string }[] }>>;
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-ink text-xl font-semibold tracking-tight">Proveedores y modelos de IA</h1>
        <p className="text-ink-soft mt-1 max-w-3xl text-sm">Aquí decides qué modelos ofrece Habiteka y cuál recomienda para cada uso. Cada organización genera con sus propias claves y puede elegir sus modelos en <strong>Mi perfil › Modelos de IA</strong>. Las claves de esta página son las de la plataforma: solo las usan este panel, Jev y tu cuenta admin.</p>
      </header>
      <AiConfigurationTabs
        providerSettings={<div className="grid gap-4 lg:grid-cols-4">
          <OpenRouterProviderForm configured={openRouter.configured} enabled={openRouter.enabled} keyHint={openRouter.keyHint} />
          <OpenAiProviderForm configured={openAi.configured} enabled={openAi.enabled} keyHint={openAi.keyHint} />
          <KieProviderForm configured={kie.configured} enabled={kie.enabled} keyHint={kie.keyHint} />
          <NanProviderForm configured={nan.configured} enabled={nan.enabled} keyHint={nan.keyHint} />
          <div className="lg:col-span-4"><BuiltInModelsPanel providers={builtInModels} ceilings={PRICE_CEILING} /></div>
          <div className="lg:col-span-4"><CustomProvidersPanel providers={customProviders} ceilings={PRICE_CEILING} /></div>
        </div>}
        modelMapping={<><div className="border-line bg-muted/30 mb-4 rounded-card border p-4">
          <p className="text-ink text-sm font-medium">Qué afecta a los usuarios</p>
          <p className="text-ink-soft mt-1 text-sm">La recomendación se aplica a cada organización mientras no elija sus propios modelos para ese uso. Si cambias un modelo recomendado, solo lo notan las organizaciones que no lo han personalizado; si retiras un modelo del catálogo, quien lo usaba vuelve a la recomendación.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MODEL_USE_GUIDE.map((use) => (
              <li key={use.action} className="bg-surface border-line rounded-control border px-3 py-2 text-sm">
                <span className="text-ink font-medium">{use.label}</span>
                <span className="text-ink-soft block text-xs">{adoption.customized[use.action] ?? 0} de {adoption.organizations} organizaciones con modelos propios</span>
              </li>
            ))}
          </ul>
        </div><ModelConfigForm actions={actions} options={options} initial={initial} profiles={[...Object.values(MODEL_PROFILES), ...customProfiles]}
          customProviders={customProviders.filter((provider) => provider.saved).map(({ id, label }) => ({ id, label }))} customActions={CUSTOM_MODEL_ACTIONS} />
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
        qualitySettings={<div className="flex flex-col gap-3">
          <p className="text-muted-foreground max-w-2xl text-sm">Jev evalúa la calidad de cada generación antes de gastar tokens: puntúa la evidencia del plano o de la petición y decide si se sigue, se pide confirmación o se manda a corregir. Su coste lo absorbe la plataforma. Los umbrales se ajustan en Ajustes de sistema (<span className="font-mono text-xs">quality_thresholds</span>).</p>
          <TypesafeProviderForm configured={typesafe.configured} enabled={typesafe.enabled} keyHint={typesafe.keyHint} />
        </div>}
      />
    </section>
  );
}
