'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ModelAction } from '@/generated/prisma/enums';
import { Button } from '@/components/ui/button';
import { adminDeleteCustomModel, adminListProviderModels, adminSaveCustomModel } from '@/server/admin/config/actions';
import type { BuiltInModelProviderView, EnabledModelView, ProviderCatalogModel } from '@/server/admin/config/custom-provider-ops';

export const USES: { action: ModelAction; label: string }[] = [
  { action: 'vision', label: 'Análisis visual' }, { action: 'chat', label: 'Asistente' },
  { action: 'plano2d', label: 'Interpretación de planos' }, { action: 'memoria', label: 'Memoria' },
];
export const inputClass = 'border-line bg-surface mt-1 w-full rounded-control border px-2 py-1';
export const Message = ({ error, text }: { error: boolean; text: string }) => <p className={`text-sm ${error ? 'text-[--color-danger]' : 'text-emerald-700'}`}>{text}</p>;
const usesLabel = (actions: ModelAction[]) => actions.map((action) => USES.find((use) => use.action === action)?.label).join(', ');

/**
 * Modelos de texto y visión de un proveedor que se pueden elegir en «Modelos por uso»: los incluidos de serie (solo en
 * OpenRouter, NaN y OpenAI) y los que habilita el administrador desde la lista que publica el proveedor, con su precio.
 */
export function ProviderModels({ providerId, models, included = [], ceilings, canLoad, autoLoad }: {
  providerId: string; models: EnabledModelView[]; included?: BuiltInModelProviderView['included']; ceilings: Record<ModelAction, number>;
  canLoad: boolean; autoLoad: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition(), [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [available, setAvailable] = useState<ProviderCatalogModel[]>([]), [filter, setFilter] = useState('');
  const [model, setModel] = useState(''), [label, setLabel] = useState(''), [price, setPrice] = useState(''), [actions, setActions] = useState<ModelAction[]>(['vision', 'chat']);
  const run = (task: () => Promise<string>) => { setMessage(null); start(async () => {
    try { setMessage({ error: false, text: await task() }); router.refresh(); }
    catch (cause) { setMessage({ error: true, text: cause instanceof Error ? cause.message : 'No se pudo completar' }); }
  }); };
  const load = () => run(async () => {
    const { models: list, note } = await adminListProviderModels(providerId);
    setAvailable(list);
    if (note) return note;
    return list.length ? `Conexión correcta: ${list.length} modelos disponibles.` : 'Conexión correcta, pero el proveedor no lista modelos: escribe el id a mano.';
  });
  // Un proveedor sin modelos que elegir carga su lista solo.
  useEffect(() => {
    if (!autoLoad) return;
    let live = true;
    adminListProviderModels(providerId).then(({ models: list }) => { if (live) setAvailable(list); }, () => undefined);
    return () => { live = false; };
  }, [autoLoad, providerId]);
  const taken = new Set([...models, ...included].map((item) => item.model));
  const shown = available.filter((item) => !taken.has(item.id) && item.id.toLowerCase().includes(filter.trim().toLowerCase())).slice(0, 80);
  const chosen = available.find((item) => item.id === model);
  const choose = (item: ProviderCatalogModel) => {
    setModel(item.id); setLabel(item.id);
    if (item.priceUsdPerMillion !== undefined) setPrice(String(item.priceUsdPerMillion));
  };
  const add = () => run(async () => {
    await adminSaveCustomModel({ providerId, model, label, actions, priceUsdPerUnit: Number(price.replace(',', '.')) });
    setModel(''); setLabel(''); setPrice('');
    return 'Modelo habilitado. Ya puedes elegirlo en «Modelos por uso».';
  });
  return <div className="flex flex-col gap-2 border-t border-line pt-3">
    {included.length > 0 && <><p className="text-sm font-medium">Incluidos de serie</p>
      <ul className="flex flex-col gap-1 text-sm">{included.map((item) => <li key={item.model}>{item.label} <span className="text-xs text-muted-foreground">· {usesLabel(item.actions)}</span></li>)}</ul></>}
    <p className="text-sm font-medium">{included.length ? 'Añadidos por ti' : 'Modelos habilitados'}</p>
    {models.length ? <ul className="flex flex-col gap-1 text-sm">{models.map((item) => <li key={item.model} className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs">{item.model}</span><span>{item.label}</span>
      <span className="text-xs text-muted-foreground">{usesLabel(item.actions)} · {item.priceUsdPerUnit} USD/1M tokens</span>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(async () => { await adminDeleteCustomModel(providerId, item.model); return 'Modelo quitado.'; })}>Quitar</Button>
    </li>)}</ul> : included.length ? <p className="text-sm text-muted-foreground">Ninguno todavía.</p>
      : <p className="text-sm text-[--color-danger]">Ninguno todavía: este proveedor no aparece en «Modelos por uso» hasta que habilites al menos un modelo.</p>}
    {canLoad ? <Button type="button" size="sm" variant="outline" className="w-fit" disabled={pending} onClick={load}>{available.length ? 'Actualizar la lista' : 'Probar conexión y ver sus modelos'}</Button>
      : <p className="text-sm text-muted-foreground">Guarda la API key del proveedor para ver sus modelos.</p>}
    {available.length > 0 && <div className="flex flex-col gap-1">
      <label className="text-sm">Modelos del proveedor ({available.length})<input className={inputClass} value={filter} placeholder="Filtra por nombre, p. ej. sonnet o qwen" onChange={(event) => setFilter(event.target.value)} /></label>
      <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">{shown.map((item) => <button key={item.id} type="button" title={item.vision === false ? 'No admite imágenes' : undefined}
        className={`rounded-control border px-2 py-0.5 font-mono text-xs ${model === item.id ? 'border-[--color-accent] bg-surface' : 'border-line'}`} onClick={() => choose(item)}>
        {item.id}{item.priceUsdPerMillion !== undefined ? ` · ${item.priceUsdPerMillion} $` : ''}{item.vision === false ? ' · solo texto' : ''}</button>)}</div>
    </div>}
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-sm">Id del modelo<input className={inputClass} value={model} placeholder="Tal como lo da el proveedor" onChange={(event) => setModel(event.target.value)} /></label>
      <label className="text-sm">Nombre en el panel<input className={inputClass} value={label} maxLength={60} placeholder="Ej. Claude Sonnet" onChange={(event) => setLabel(event.target.value)} /></label>
      <label className="text-sm">Precio de entrada (USD por 1M tokens)<input className={inputClass} inputMode="decimal" value={price} placeholder="Ej. 2" onChange={(event) => setPrice(event.target.value)} />
        <span className="mt-1 block text-xs text-muted-foreground">{chosen?.priceUsdPerMillion !== undefined ? 'El que publica el proveedor. ' : 'El de la web del proveedor; 0 si es gratuito o va en tu suscripción. '}
          Máximo: {USES.map((use) => `${use.label} ${ceilings[use.action]}`).join(' · ')}.</span></label>
      <fieldset className="text-sm"><legend>Usos</legend><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{USES.map((use) => <label key={use.action} className="flex items-center gap-1">
        <input type="checkbox" checked={actions.includes(use.action)} onChange={(event) => setActions((current) => event.target.checked ? [...current, use.action] : current.filter((action) => action !== use.action))} />{use.label}</label>)}</div></fieldset>
    </div>
    {chosen?.vision === false && actions.includes('vision') && <p className="text-sm text-[--color-danger]">Este modelo no admite imágenes: en «Análisis visual» fallaría y pasaría al respaldo.</p>}
    <Button type="button" size="sm" variant="outline" className="w-fit" disabled={pending || !model.trim() || !price.trim() || !actions.length} onClick={add}>{pending ? 'Guardando…' : 'Habilitar modelo'}</Button>
    {message && <Message {...message} />}
  </div>;
}

/** OpenRouter, NaN, OpenAI y KIE con sus modelos incluidos y los que se habilitan aquí, como en los proveedores propios. */
export function BuiltInModelsPanel({ providers, ceilings }: { providers: BuiltInModelProviderView[]; ceilings: Record<ModelAction, number> }) {
  return <section className="flex flex-col gap-3">
    <div><h2 className="font-medium">Modelos de OpenRouter, NaN, OpenAI y KIE</h2>
      <p className="text-sm text-muted-foreground">Los incluidos de serie ya aparecen en «Modelos por uso». Puedes habilitar otros modelos de texto y visión de cada proveedor (en KIE, sus modelos Claude); usan la clave guardada arriba.</p></div>
    <div className="grid gap-4 lg:grid-cols-2">{providers.map((provider) => <div key={provider.id} className="flex flex-col gap-2 rounded-card border border-line p-4">
      <h3 className="font-medium">{provider.label}</h3>
      <ProviderModels providerId={provider.id} models={provider.models} included={provider.included} ceilings={ceilings} canLoad={provider.configured} autoLoad={false} />
    </div>)}</div>
  </section>;
}
