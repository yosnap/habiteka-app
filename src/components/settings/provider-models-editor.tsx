'use client';

/**
 * Modelos de texto y visión de un proveedor que la organización puede elegir en «Modelos de IA»: los que ya trae el
 * catálogo de Habiteka y los que habilita desde la lista que publica el proveedor con su clave, con su precio.
 */
import { useState, useTransition } from 'react';
import type { ModelAction } from '@/generated/prisma/enums';
import { Button } from '@/components/ui/button';
import { callAction } from '@/lib/action-result';
import { deleteEnabledModelAction, listProviderCatalogAction, saveEnabledModelAction } from '@/server/settings/organization-ai-key-actions';
import type { ProviderCatalogModel, ProviderModelsView } from '@/server/settings/organization-catalog-ops';
import { FormStatus, fieldClass, type FormResult } from '@/components/profile/form-status';

const USES: { action: ModelAction; label: string }[] = [
  { action: 'vision', label: 'Análisis visual' }, { action: 'chat', label: 'Asistente' },
  { action: 'plano2d', label: 'Interpretación de planos' }, { action: 'memoria', label: 'Memoria' },
];
const usesLabel = (actions: ModelAction[]) => actions.map((action) => USES.find((use) => use.action === action)?.label).filter(Boolean).join(', ');

export function ProviderModelsEditor({ view, canLoad }: { view: ProviderModelsView; canLoad: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormResult>(null);
  const [available, setAvailable] = useState<ProviderCatalogModel[]>([]);
  const [filter, setFilter] = useState('');
  const [model, setModel] = useState(''), [label, setLabel] = useState(''), [price, setPrice] = useState('');
  const [actions, setActions] = useState<ModelAction[]>(['vision', 'chat']);
  const run = (task: () => Promise<string>) => { setResult(null); start(async () => {
    try { setResult({ ok: true, message: await task() }); }
    catch (cause) { setResult({ ok: false, message: cause instanceof Error ? cause.message : 'No se pudo completar.' }); }
  }); };
  const load = () => run(async () => {
    const { models, note } = await callAction(listProviderCatalogAction(view.provider));
    setAvailable(models);
    return note ?? (models.length ? `Conexión correcta: ${models.length} modelos disponibles.` : 'Conexión correcta, pero el proveedor no lista modelos: escribe el id a mano.');
  });
  const taken = new Set([...view.models, ...view.included].map((item) => item.model));
  const shown = available.filter((item) => !taken.has(item.id) && item.id.toLowerCase().includes(filter.trim().toLowerCase())).slice(0, 80);
  const chosen = available.find((item) => item.id === model);
  const choose = (item: ProviderCatalogModel) => {
    setModel(item.id); setLabel(item.id);
    if (item.priceUsdPerMillion !== undefined) setPrice(String(item.priceUsdPerMillion));
  };
  const add = () => run(async () => {
    await callAction(saveEnabledModelAction({ providerId: view.provider, model, label, actions, priceUsdPerUnit: Number(price.replace(',', '.')) }));
    setModel(''); setLabel(''); setPrice('');
    return 'Modelo habilitado. Ya puedes elegirlo en «Modelos de IA».';
  });

  return (
    <div className="flex flex-col gap-3">
      {view.included.length > 0 ? (
        <div>
          <p className="text-ink text-sm font-medium">Incluidos en el catálogo de Habiteka</p>
          <ul className="text-ink-soft mt-1 flex flex-col gap-0.5 text-sm">{view.included.map((item) => <li key={item.model}>{item.label} <span className="text-xs">· {usesLabel(item.actions)}</span></li>)}</ul>
        </div>
      ) : null}
      <div>
        <p className="text-ink text-sm font-medium">Habilitados por tu organización</p>
        {view.models.length ? (
          <ul className="mt-1 flex flex-col gap-1 text-sm">{view.models.map((item) => (
            <li key={item.model} className="flex flex-wrap items-center gap-2">
              <span className="text-ink">{item.label}</span>
              <span className="text-ink-soft text-xs">{usesLabel(item.actions)} · {item.priceUsdPerUnit} USD/1M tokens</span>
              <button type="button" className="text-xs text-[--color-danger] hover:underline" disabled={pending}
                onClick={() => run(async () => { await callAction(deleteEnabledModelAction(view.provider, item.model)); return 'Modelo quitado.'; })}>Quitar</button>
            </li>
          ))}</ul>
        ) : <p className="text-ink-soft mt-1 text-sm">{view.included.length ? 'Ninguno todavía.' : 'Ninguno todavía: habilita al menos un modelo para usar este proveedor.'}</p>}
      </div>
      {canLoad ? <Button type="button" size="sm" variant="outline" className="w-fit" disabled={pending} onClick={load}>{available.length ? 'Actualizar la lista' : 'Ver los modelos del proveedor'}</Button>
        : <p className="text-ink-soft text-sm">Guarda la clave para ver los modelos del proveedor.</p>}
      {available.length > 0 ? (
        <label className="text-ink-soft text-sm">Modelos del proveedor ({available.length})
          <input className={fieldClass} value={filter} placeholder="Filtra por nombre, por ejemplo sonnet o qwen" onChange={(event) => setFilter(event.target.value)} />
          <span className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto">{shown.map((item) => (
            <button key={item.id} type="button" onClick={() => choose(item)}
              className={`rounded-control border px-2 py-0.5 font-mono text-xs ${model === item.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink'}`}>
              {item.id}{item.priceUsdPerMillion !== undefined ? ` · ${item.priceUsdPerMillion} $` : ''}{item.vision === false ? ' · solo texto' : ''}
            </button>
          ))}</span>
        </label>
      ) : null}
      {canLoad ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-ink-soft text-sm">Id del modelo<input className={fieldClass} value={model} placeholder="Tal como lo da el proveedor" onChange={(event) => setModel(event.target.value)} /></label>
          <label className="text-ink-soft text-sm">Nombre<input className={fieldClass} value={label} maxLength={60} placeholder="Ej. Claude Sonnet" onChange={(event) => setLabel(event.target.value)} /></label>
          <label className="text-ink-soft text-sm">Precio de entrada (USD por 1M tokens)<input className={fieldClass} inputMode="decimal" value={price} placeholder="Ej. 2" onChange={(event) => setPrice(event.target.value)} />
            <span className="mt-1 block text-xs">{chosen?.priceUsdPerMillion !== undefined ? 'El que publica el proveedor.' : 'El de la web del proveedor; 0 si es gratuito o va en tu suscripción.'}</span></label>
          <fieldset className="text-ink-soft text-sm"><legend>Usos</legend>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{USES.map((use) => (
              <label key={use.action} className="flex items-center gap-1">
                <input type="checkbox" checked={actions.includes(use.action)} onChange={(event) => setActions((current) => event.target.checked ? [...current, use.action] : current.filter((action) => action !== use.action))} />{use.label}
              </label>
            ))}</div>
          </fieldset>
        </div>
      ) : null}
      {chosen?.vision === false && actions.includes('vision') ? <p className="text-sm text-[--color-danger]">Este modelo no admite imágenes: en «Análisis visual» fallaría y pasaría al respaldo.</p> : null}
      {canLoad ? <Button type="button" size="sm" className="w-fit" disabled={pending || !model.trim() || !price.trim() || !actions.length} onClick={add}>{pending ? 'Guardando…' : 'Habilitar modelo'}</Button> : null}
      <FormStatus result={result} />
    </div>
  );
}
