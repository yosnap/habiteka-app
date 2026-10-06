'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ModelAction } from '@/generated/prisma/enums';
import { Button } from '@/components/ui/button';
import { adminDeleteCustomProvider, adminSaveCustomProvider } from '@/server/admin/config/actions';
import { inputClass, Message, ProviderModels } from './provider-models';
import type { CustomProviderView } from '@/server/admin/config/custom-provider-ops';

/**
 * Proveedores con API compatible con OpenAI (APIMart, NodeClub.ai…): URL base, clave cifrada y los modelos de texto y
 * visión que se habilitan para cada uso. Después se eligen en «Modelos por uso» como cualquier otro.
 */
export function CustomProvidersPanel({ providers, ceilings }: { providers: CustomProviderView[]; ceilings: Record<ModelAction, number> }) {
  const [adding, setAdding] = useState(false);
  return <section className="flex flex-col gap-3">
    <div><h2 className="font-medium">Proveedores compatibles con OpenAI</h2>
      <p className="text-sm text-muted-foreground">Añade cualquier proveedor que acepte peticiones como OpenAI: su URL base y su API key. Después habilita en su tarjeta los modelos que quieras usar: solo esos aparecen en «Modelos por uso». Solo para texto y visión; las imágenes siguen con KIE, OpenRouter u OpenAI.</p></div>
    <div className="grid gap-4 lg:grid-cols-2">
      {providers.map((provider) => <ProviderCard key={provider.id} provider={provider} ceilings={ceilings} />)}
      {adding ? <ProviderCard ceilings={ceilings} onDone={() => setAdding(false)} /> : <Button type="button" variant="outline" className="w-fit" onClick={() => setAdding(true)}>Añadir proveedor</Button>}
    </div>
  </section>;
}

function ProviderCard({ provider, ceilings, onDone }: { provider?: CustomProviderView; ceilings: Record<ModelAction, number>; onDone?: () => void }) {
  const router = useRouter();
  const [label, setLabel] = useState(provider?.label ?? ''), [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? ''), [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(provider?.enabled ?? true), [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (task: () => Promise<string>) => { setMessage(null); start(async () => {
    try { setMessage({ error: false, text: await task() }); router.refresh(); }
    catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : 'No se pudo completar' }); }
  }); };
  const save = () => run(async () => {
    await adminSaveCustomProvider({ id: provider?.saved || provider?.preset ? provider.id : undefined, label, baseUrl, apiKey, enabled });
    setApiKey(''); onDone?.();
    return 'Proveedor guardado.';
  });
  const remove = () => run(async () => { await adminDeleteCustomProvider(provider!.id); return 'Proveedor borrado.'; });
  return <div className="flex flex-col gap-3 rounded-card border border-line p-4">
    <div><h3 className="font-medium">{provider?.label ?? 'Nuevo proveedor'}{provider?.preset ? ' · preconfigurado' : ''}</h3>
      <p className="text-sm text-muted-foreground">{provider?.configured ? `Clave configurada: ${provider.keyHint}` : 'Sin clave configurada'}{provider?.configured && !provider.enabled ? ' · desactivado' : ''}</p></div>
    {!provider?.preset && <label className="text-sm">Nombre<input className={inputClass} value={label} maxLength={40} placeholder="Ej. NodeClub.ai" disabled={!!provider?.saved} onChange={(event) => setLabel(event.target.value)} /></label>}
    <label className="text-sm">URL base<input className={inputClass} value={baseUrl} placeholder="https://api.proveedor.com/v1" disabled={!!provider?.preset} onChange={(event) => setBaseUrl(event.target.value)} /></label>
    <label className="text-sm">API key<input className={inputClass} type="password" value={apiKey} autoComplete="new-password" placeholder={provider?.configured ? 'Pega una nueva clave para sustituirla' : 'Pega la clave del proveedor'} onChange={(event) => setApiKey(event.target.value)} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Habilitar para los usos asignados</label>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={save}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      {provider?.saved && !provider.preset && <Button type="button" size="sm" variant="outline" disabled={pending} onClick={remove}>Borrar</Button>}
      {onDone && <Button type="button" size="sm" variant="outline" onClick={onDone}>Cancelar</Button>}
    </div>
    {message && <Message {...message} />}
    {provider?.saved && <ProviderModels providerId={provider.id} models={provider.models} ceilings={ceilings} canLoad={provider.configured}
      autoLoad={provider.configured && provider.models.length === 0} />}
  </div>;
}
