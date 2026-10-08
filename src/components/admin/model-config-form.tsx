'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ModelAction } from '@/generated/prisma/enums';
import { Button } from '@/components/ui/button';
import { ModernSelect } from '@/components/ui/modern-select';
import { adminReplaceModelConfigs, adminSaveCustomModelProfile } from '@/server/admin/config/actions';

/** `group` es el nombre del proveedor propio (APIMart, NodeClub.ai…); los integrados se agrupan por su id. */
interface ModelOption { id: string; label: string; provider: string; status: 'current' | 'legacy' | 'deprecated'; group?: string; }
interface Backup { model: string; provider: string; }
interface Selection { primaryModel: string; provider: string; enabled: boolean; backups: Backup[]; }
interface Profile { id: string; name: string; description: string; configurations: Array<Selection & { action: ModelAction }>; }
/** `customProviders` y `customActions`: proveedores propios guardados y usos que pueden atender, para avisar de los que aún no tienen modelos. */
interface Props { actions: ModelAction[]; options: Record<ModelAction, ModelOption[]>; initial: Partial<Record<ModelAction, Selection>>; profiles: Profile[];
  customProviders?: { id: string; label: string }[]; customActions?: readonly ModelAction[]; }

const actionLabels: Record<ModelAction, string> = {
  vision: 'Análisis visual', chat: 'Asistente', plano2d: 'Interpretación de planos',
  render3d: 'Render 3D', inpaint: 'Edición de imágenes', memoria: 'Memoria del proyecto',
};
const statusSuffix = { current: '', legacy: ' · Anterior', deprecated: ' · ⚠ Deprecado' } as const;
const BUILT_IN = new Set(['openrouter', 'openai', 'kie', 'nan']);
/** El mismo id de modelo puede existir en dos proveedores: la opción se identifica por los dos. */
const keyOf = (provider: string, id: string) => `${provider}::${id}`;

function initialSelections(actions: ModelAction[], options: Props['options'], initial: Props['initial']): Record<ModelAction, Selection> {
  return Object.fromEntries(actions.map((action) => {
    const fallback = options[action][0]!;
    return [action, initial[action] ?? { primaryModel: fallback.id, provider: fallback.provider, enabled: true, backups: [] }];
  })) as Record<ModelAction, Selection>;
}

export function ModelConfigForm({ actions, options, initial, profiles, customProviders = [], customActions = [] }: Props) {
  const [selections, setSelections] = useState(() => initialSelections(actions, options, initial));
  const [profileId, setProfileId] = useState(profiles[0]!.id);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customProfileName, setCustomProfileName] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  const save = (next = selections, success = 'Configuración guardada.') => {
    setError(null); setNotice(null);
    start(async () => {
      try {
        await adminReplaceModelConfigs(actions.map((action) => ({ action, ...next[action] })));
        setNotice(success);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los modelos');
      }
    });
  };
  const optionFor = (action: ModelAction, value: string) => options[action].find((item) => keyOf(item.provider, item.id) === value);
  const updateSelection = (action: ModelAction, value: string) => {
    const option = optionFor(action, value);
    if (!option) return;
    setSelections((current) => ({ ...current, [action]: { ...current[action], primaryModel: option.id, provider: option.provider } }));
  };
  const updateBackup = (action: ModelAction, index: number, value: string) => {
    const option = optionFor(action, value);
    if (!option) return;
    setSelections((current) => {
      const backups = [...current[action].backups];
      backups[index] = { model: option.id, provider: option.provider };
      return { ...current, [action]: { ...current[action], backups } };
    });
  };
  const addBackup = (action: ModelAction) => {
    const option = options[action].find((item) => keyOf(item.provider, item.id) !== keyOf(selections[action].provider, selections[action].primaryModel));
    if (!option) return;
    setSelections((current) => ({ ...current, [action]: { ...current[action], backups: [...current[action].backups, { model: option.id, provider: option.provider }] } }));
  };
  const removeBackup = (action: ModelAction, index: number) => setSelections((current) => ({ ...current, [action]: { ...current[action], backups: current[action].backups.filter((_, itemIndex) => itemIndex !== index) } }));
  const applyProfile = () => {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    const next = initialSelections(actions, options, initial);
    profile.configurations.forEach((config) => { next[config.action] = config; });
    setSelections(next);
    save(next, `Perfil «${profile.name}» aplicado.`);
  };
  const loadProfile = (profile: Profile) => {
    const next = initialSelections(actions, options, initial);
    profile.configurations.forEach((config) => { next[config.action] = config; });
    setProfileId(profile.id);
    setSelections(next);
    setNotice(`Perfil «${profile.name}» cargado como borrador.`);
  };
  const saveAsProfile = () => {
    setError(null); setNotice(null);
    start(async () => {
      try {
        await adminSaveCustomModelProfile({ name: customProfileName, configurations: actions.map((action) => ({ action, ...selections[action] })) });
        setCustomProfileName('');
        setNotice('Perfil personalizado guardado.');
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo guardar el perfil personalizado');
      }
    });
  };

  return <section className="flex max-w-3xl flex-col gap-4 rounded-card border border-line p-4">
    <div><h2 className="font-medium">Modelos por uso</h2><p className="text-sm text-muted-foreground">Elige un modelo para cada capacidad. Los cambios se guardan todos juntos.</p></div>
    <div className="flex flex-wrap items-end gap-3 rounded-control bg-muted/30 p-3">
      <label className="text-sm">Perfil automático<ModernSelect className="mt-1" value={profileId} onChange={(event) => setProfileId(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</ModernSelect></label>
      <Button type="button" size="sm" disabled={pending} onClick={applyProfile}>{pending ? 'Aplicando…' : 'Aplicar perfil'}</Button>
      <p className="max-w-sm text-xs text-muted-foreground">{profiles.find((profile) => profile.id === profileId)?.description}</p>
    </div>
    <div className="flex flex-wrap items-end gap-2 rounded-control border border-dashed border-line p-3">
      <label className="text-sm">Guardar como perfil personalizado<input className="border-line bg-surface mt-1 block rounded-control border px-2 py-1" value={customProfileName} maxLength={60} placeholder="Ej. Renders premium" onChange={(event) => setCustomProfileName(event.target.value)} /></label>
      <Button type="button" size="sm" variant="outline" disabled={pending || customProfileName.trim().length < 3} onClick={saveAsProfile}>Guardar perfil</Button>
    </div>
    {profiles.filter((profile) => profile.id !== 'balanced' && profile.id !== 'professional').length > 0 && <div className="rounded-control border border-line p-3">
      <p className="text-sm font-medium">Mis perfiles guardados</p>
      <div className="mt-2 flex flex-wrap gap-2">{profiles.filter((profile) => profile.id !== 'balanced' && profile.id !== 'professional').map((profile) => <Button key={profile.id} type="button" size="sm" variant="outline" onClick={() => loadProfile(profile)}>Cargar «{profile.name}»</Button>)}</div>
      <p className="mt-2 text-xs text-muted-foreground">Cargar no guarda cambios: puedes editar el borrador y crear otro perfil con un nombre distinto.</p>
    </div>}
    <div className="grid gap-3 sm:grid-cols-2">
      {actions.map((action) => {
        const selected = selections[action];
        const openRouter = options[action].filter((item) => item.provider === 'openrouter');
        const openAi = options[action].filter((item) => item.provider === 'openai');
        const kie = options[action].filter((item) => item.provider === 'kie');
        const nan = options[action].filter((item) => item.provider === 'nan');
        const custom = [...new Set(options[action].filter((item) => !BUILT_IN.has(item.provider)).map((item) => item.provider))];
        const withoutModels = customActions.includes(action) ? customProviders.filter((provider) => !custom.includes(provider.id)).map((provider) => provider.label) : [];
        const optionList = (items: ModelOption[]) => items.map((item) => <option key={keyOf(item.provider, item.id)} value={keyOf(item.provider, item.id)}>{item.label}{statusSuffix[item.status]}</option>);
        const renderOptions = () => <>
            <optgroup label="OpenRouter">{optionList(openRouter)}</optgroup>
            {nan.length > 0 && <optgroup label="NaN · OpenAI-compatible">{optionList(nan)}</optgroup>}
            {custom.map((provider) => { const items = options[action].filter((item) => item.provider === provider);
              return <optgroup key={provider} label={`${items[0]?.group ?? provider} · OpenAI-compatible`}>{optionList(items)}</optgroup>; })}
            {kie.length > 0 && <optgroup label={action === 'render3d' || action === 'inpaint' ? 'KIE · imagen' : 'KIE · Claude'}>{optionList(kie)}</optgroup>}
            {openAi.length > 0 && <optgroup label="OpenAI · directo">{optionList(openAi)}</optgroup>}
          </>;
        return <div key={action} className="rounded-control border border-line p-3 text-sm"><span className="font-medium">{actionLabels[action]}</span>
          <label className="mt-2 block text-xs text-muted-foreground">Primario<ModernSelect className="mt-1" value={keyOf(selected.provider, selected.primaryModel)} onChange={(event) => updateSelection(action, event.target.value)}>{renderOptions()}</ModernSelect></label>
          {selected.backups.map((backup, index) => <div key={`${backup.provider}-${backup.model}-${index}`} className="mt-2 flex items-end gap-2"><label className="min-w-0 flex-1 text-xs text-muted-foreground">Respaldo {index + 1}<ModernSelect className="mt-1" value={keyOf(backup.provider, backup.model)} onChange={(event) => updateBackup(action, index, event.target.value)}>{renderOptions()}</ModernSelect></label><Button type="button" size="sm" variant="outline" onClick={() => removeBackup(action, index)}>Quitar</Button></div>)}
          {selected.backups.length < 3 && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => addBackup(action)}>Añadir respaldo</Button>}
          {withoutModels.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{withoutModels.join(' y ')} {withoutModels.length > 1 ? 'no tienen' : 'no tiene'} modelos habilitados para este uso. Habilítalos en <strong>Configuración IA</strong>, dentro de su tarjeta.</p>}
        </div>;
      })}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={pending} onClick={() => save()}>{pending ? 'Guardando…' : 'Guardar todos los usos'}</Button>
      {error && <p className="text-sm text-[--color-danger]">{error}</p>}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
    </div>
    <p className="text-xs text-muted-foreground">⚠ Deprecado indica un modelo que no se recomienda para nuevas configuraciones. KIE ya se ejecuta mediante tareas asíncronas y los perfiles lo usan para imagen.</p>
  </section>;
}
