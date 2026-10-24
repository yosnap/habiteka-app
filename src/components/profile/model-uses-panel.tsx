'use client';

/**
 * Elección de modelos por uso de la organización. Cada tarjeta explica el uso, enseña la recomendación del panel y
 * deja elegir un principal y hasta tres respaldos entre los modelos habilitados. Sin elección se usa la recomendación.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, Lightbulb, Plus, Sparkles, X } from 'lucide-react';
import type { ModelAction } from '@/generated/prisma/enums';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModernSelect } from '@/components/ui/modern-select';
import { callAction } from '@/lib/action-result';
import { MAX_MODEL_BACKUPS, type ModelUseGuide } from '@/lib/ai-model-guide';
import { resetModelUseAction, saveModelUseAction } from '@/server/settings/profile-actions';
import type { ModelChoice, ModelUseView } from '@/server/settings/organization-model-ops';
import { FormStatus, type FormResult } from './form-status';

const IMAGE_ACTIONS = new Set<ModelAction>(['render3d', 'inpaint']);
const keyOf = (choice: { provider: string; model: string }) => `${choice.provider}::${choice.model}`;

function price(action: ModelAction, usd: number): string {
  return IMAGE_ACTIONS.has(action) ? `${usd.toFixed(3)} USD/imagen` : `${usd.toFixed(2)} USD/1M tokens`;
}

function ChainLine({ chain, action }: { chain: ModelChoice[]; action: ModelAction }) {
  if (chain.length === 0) return <p className="text-ink-soft text-sm">Sin modelos disponibles.</p>;
  return (
    <ol className="flex flex-col gap-1">
      {chain.map((choice, index) => (
        <li key={keyOf(choice)} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="bg-muted text-ink-soft rounded-full px-2 py-0.5 text-xs">{index === 0 ? 'Principal' : `Respaldo ${index}`}</span>
          <span className="text-ink font-medium">{choice.label}</span>
          <span className="text-ink-soft text-xs">{choice.providerLabel} · {price(action, choice.priceUsdPerUnit)}</span>
          {!choice.hasKey ? <span className="text-xs text-[--color-danger]">Sin clave</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function ModelUsesPanel({ uses, guide, canEdit }: { uses: ModelUseView[]; guide: readonly ModelUseGuide[]; canEdit: boolean }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {guide.map((info) => {
        const use = uses.find((item) => item.action === info.action);
        return use ? <ModelUseCard key={info.action} use={use} info={info} canEdit={canEdit} /> : null;
      })}
    </div>
  );
}

function ModelUseCard({ use, info, canEdit }: { use: ModelUseView; info: ModelUseGuide; canEdit: boolean }) {
  const active = use.own ?? use.recommended;
  const [editing, setEditing] = useState(false);
  const [chain, setChain] = useState<string[]>(() => active.map(keyOf));
  const [result, setResult] = useState<FormResult>(null);
  const [pending, start] = useTransition();
  const byKey = new Map(use.options.map((option) => [keyOf(option), option]));
  const usable = active.some((choice) => choice.hasKey);
  const missingProviders = [...new Set(active.map((choice) => choice.providerLabel))];

  const save = () => start(async () => {
    try {
      const refs = chain.map((key) => byKey.get(key)).filter((choice): choice is ModelChoice => !!choice).map(({ provider, model }) => ({ provider, model }));
      await callAction(saveModelUseAction(use.action, refs));
      setEditing(false); setResult({ ok: true, message: 'Modelos guardados para este uso.' });
    } catch (cause) { setResult({ ok: false, message: cause instanceof Error ? cause.message : 'No se pudo guardar.' }); }
  });
  const reset = () => start(async () => {
    try {
      await callAction(resetModelUseAction(use.action));
      setChain(use.recommended.map(keyOf)); setEditing(false);
      setResult({ ok: true, message: 'Este uso vuelve a los modelos recomendados.' });
    } catch (cause) { setResult({ ok: false, message: cause instanceof Error ? cause.message : 'No se pudo restablecer.' }); }
  });
  // Cada desplegable ofrece los modelos que aún no están en la cadena, agrupados por proveedor.
  const grouped = (current: string) => {
    const available = use.options.filter((option) => keyOf(option) === current || !chain.includes(keyOf(option)));
    return [...new Set(available.map((option) => option.providerLabel))].map((group) => (
      <optgroup key={group} label={group}>
        {available.filter((option) => option.providerLabel === group).map((option) => (
          <option key={keyOf(option)} value={keyOf(option)}>
            {`${option.label} · ${price(use.action, option.priceUsdPerUnit)}${option.hasKey ? '' : ' · sin clave'}`}
          </option>
        ))}
      </optgroup>
    ));
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-ink text-base font-semibold">{info.label}</h3>
          <p className="text-ink-soft text-sm">{info.purpose}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${use.own ? 'bg-brand-50 text-brand-700' : 'bg-muted text-ink-soft'}`}>
          {use.own ? 'Tu elección' : 'Recomendado'}
        </span>
      </header>
      <p className="bg-muted text-ink-soft flex gap-2 rounded-control p-3 text-sm">
        <Lightbulb size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{info.advice}</span>
      </p>
      {editing ? (
        <div className="flex flex-col gap-2">
          {chain.map((key, index) => (
            <div key={`${index}-${key}`} className="flex items-center gap-2">
              <span className="text-ink-soft w-20 shrink-0 text-xs">{index === 0 ? 'Principal' : `Respaldo ${index}`}</span>
              <ModernSelect value={key} onChange={(event) => setChain(chain.map((item, position) => position === index ? event.target.value : item))}>
                {grouped(key)}
              </ModernSelect>
              {index > 0 ? (
                <button type="button" aria-label={`Quitar respaldo ${index}`} className="text-ink-soft hover:text-ink rounded-control p-1"
                  onClick={() => setChain(chain.filter((_, position) => position !== index))}><X size={16} /></button>
              ) : <span className="w-6" />}
            </div>
          ))}
          {chain.length <= MAX_MODEL_BACKUPS && chain.length < use.options.length ? (
            <button type="button" className="text-brand-700 inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline"
              onClick={() => { const next = use.options.find((option) => !chain.includes(keyOf(option))); if (next) setChain([...chain, keyOf(next)]); }}>
              <Plus size={14} aria-hidden />Añadir respaldo
            </button>
          ) : null}
          <p className="text-ink-soft text-xs">Si el principal falla o no tienes su clave, se prueba el siguiente.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending || chain.length === 0} onClick={save}>Guardar</Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => { setChain(active.map(keyOf)); setEditing(false); }}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ChainLine chain={active} action={use.action} />
          {use.own ? (
            <div className="text-ink-soft flex flex-col gap-1 text-xs">
              <span className="flex items-center gap-1"><Sparkles size={12} aria-hidden />Recomendado por Habiteka:</span>
              <ChainLine chain={use.recommended} action={use.action} />
            </div>
          ) : null}
          {!usable && active.length > 0 ? (
            <p className="flex items-start gap-2 rounded-control border border-[--color-danger] p-3 text-sm text-[--color-danger]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>Ahora no se puede usar: falta la clave de {missingProviders.join(' o ')}. <Link href="/perfil/claves-ia" className="underline">Añadir clave</Link></span>
            </p>
          ) : null}
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={pending || use.options.length === 0} onClick={() => { setResult(null); setEditing(true); }}>Elegir modelos</Button>
              {use.own ? <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={reset}>Usar los recomendados</Button> : null}
            </div>
          ) : null}
        </div>
      )}
      <FormStatus result={result} />
    </Card>
  );
}
