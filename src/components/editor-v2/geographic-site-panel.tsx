'use client';
import { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { useStore } from 'zustand';
import { MapPin } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { callAction } from '@/lib/action-result';
import { LIGHTING_LABELS, LIGHTING_PRESETS } from '@/lib/lighting-preset';
import { geographicSiteSchema, sitePlanOrigin, type GeographicSite } from '@/lib/editor-document/geographic-site';
import { propertyNorth, siteRotationForNorth } from '@/lib/editor-document/property-orientation';
import { GeographicSiteMap } from './geographic-site-map';
import { loadSiteOrthophoto, resolveSiteOrthophoto } from '@/server/editor/geographic-site-actions';
import { ModernSelect } from '@/components/ui/modern-select';
import { ZodError } from 'zod';
import { SiteAdjustmentControl } from './site-adjustment-control';
import { GeographicSiteNextSteps, type SiteNextStepsProps } from './geographic-site-next-steps';

export function GeographicSitePanel({ store, projectId, readOnly, ...nextSteps }: SiteNextStepsProps & {
  store: EditorStore; projectId: string; readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuContainer, setMenuContainer] = useState<HTMLDivElement | null>(null);
  const continueWith = (action?: () => void) => action ? () => { setOpen(false); action(); } : undefined;
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" data-project-menu-action><MapPin size={18} /><span>Parcela real</span></button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[150] bg-black/50" />
      <Dialog.Content ref={setMenuContainer} onInteractOutside={event => event.preventDefault()}
        className="fixed inset-2 z-[151] flex flex-col overflow-y-auto rounded-2xl bg-white text-ink shadow-2xl lg:inset-5 lg:overflow-hidden [&_button]:cursor-pointer [&_button]:transition-colors [&_button]:active:bg-emerald-100 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
          <div><Dialog.Title className="text-lg font-semibold">Encaja tu diseño en la parcela</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink-soft">Ajusta la fotografía, el diseño y la zona que sustituye a la casa actual.</Dialog.Description></div>
          <Dialog.Close className="rounded-lg border px-3 py-2 text-sm hover:bg-stone-50">Cerrar</Dialog.Close>
        </div>
        {open && <SiteEditor store={store} projectId={projectId} readOnly={readOnly} menuContainer={menuContainer}
          {...nextSteps} onReviewApproval={continueWith(nextSteps.onReviewApproval)} onOpenApproved={continueWith(nextSteps.onOpenApproved)} />}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function SiteEditor({ store, projectId, readOnly, menuContainer, ...nextSteps }: SiteNextStepsProps & {
  store: EditorStore; projectId: string; readOnly: boolean; menuContainer: HTMLElement | null;
}) {
  const doc = useStore(store, state => state.document);
  const [site, setSite] = useState<GeographicSite | undefined>(doc.geographicSite);
  const [coordinates, setCoordinates] = useState(doc.geographicSite
    ? `${doc.geographicSite.latitude}, ${doc.geographicSite.longitude}` : '');
  const [width, setWidth] = useState(doc.geographicSite?.groundWidthM ?? 180);
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!doc.geographicSite) return;
    let active = true;
    void callAction(resolveSiteOrthophoto(projectId, doc.geographicSite))
      .then(value => { if (active) setUrl(value); })
      .catch(() => { if (active) setMessage('No se pudo abrir la ortofoto guardada.'); });
    return () => { active = false; };
  }, [projectId, doc.geographicSite]);
  function patch(value: Partial<GeographicSite>) {
    setMessage('');
    setSite(current => {
      if (!current || Object.entries(value).every(([key, next]) => JSON.stringify(current[key as keyof GeographicSite]) === JSON.stringify(next))) return current;
      return { ...current, ...value, confirmed: false };
    });
  }
  async function load() {
    setPending(true); setMessage('');
    try {
      const pair = coordinates.trim().split(/[;,\s]+/).filter(Boolean).map(Number);
      if (pair.length !== 2 || pair.some(n => !Number.isFinite(n))) throw new Error('Escribe latitud, longitud en grados decimales.');
      const image = await callAction(loadSiteOrthophoto(projectId, { latitude: pair[0], longitude: pair[1], groundWidthM: width }));
      const { url: imageUrl, ...data } = image;
      setSite({ ...data, anchor: { x: .5, y: .5 }, planOriginMm: sitePlanOrigin(doc), rotationDeg: siteRotationForNorth(propertyNorth(doc) ?? 0),
        intervention: [], scenario: 'new-build', lighting: site?.lighting ?? 'daylight', confirmed: false });
      setUrl(imageUrl); setMessage('Fotografía lista. Acerca la casa y tapa la construcción que vas a sustituir.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cargar la ortofoto.'); }
    finally { setPending(false); }
  }
  function save(confirmed: boolean) {
    try {
      const value = geographicSiteSchema.parse({ ...site, confirmed });
      store.getState().apply({ ...store.getState().document, geographicSite: value, revision: store.getState().document.revision + 1 });
      setSite(value);
      setMessage(confirmed ? 'Encaje confirmado. Continúa abajo con la aprobación o abre los vídeos con tus imágenes.' : 'Cambios guardados. Revisa escenario y luz; después confirma el encaje.');
    } catch (error) {
      if (error instanceof ZodError)
        setMessage(error.issues[0]?.path[0] === 'intervention'
          ? 'La zona tapada sale de la fotografía o tiene una forma inválida. Reduce su tamaño o muévela dentro de la imagen.'
          : 'Los ajustes de ubicación no son válidos. Comprueba el tamaño del diseño y vuelve a cargar la fotografía si el problema continúa.');
      else setMessage(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.');
    }
  }
  const disabled = readOnly || pending;
  const dirty = JSON.stringify(site) !== JSON.stringify(doc.geographicSite);
  const locationControls = <details open={!site} className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Coordenadas y fotografía</summary>
      <label className="mt-3 block">Coordenadas (latitud, longitud)<input className="mt-1 w-full rounded border p-2"
        value={coordinates} disabled={disabled} placeholder="Latitud, longitud en grados decimales" onChange={e => setCoordinates(e.target.value)} /></label>
      <label className="block">Ancho de la ortofoto (40–500 m)<input type="number" min="40" max="500"
        className="mt-1 w-full rounded border p-2" value={width} disabled={disabled} onChange={e => setWidth(Number(e.target.value))} /></label>
      <button type="button" disabled={disabled || !doc.vertices.length} className="rounded border px-3 py-2" onClick={() => void load()}>
        {pending ? 'Cargando…' : 'Cargar fotografía de la parcela'}</button>
      </details>;
  const videoControls = site && <>
        <label className="block">Qué vas a hacer<ModernSelect portalContainer={menuContainer} popoverZIndex={200} value={site.scenario} disabled={disabled}
          onChange={e => patch({ scenario: e.target.value as GeographicSite['scenario'] })}>
          <option value="new-build">Obra nueva en parte libre</option><option value="reconstruction">Sustituir construcción existente</option>
          <option value="reform">Reforma de construcción existente</option>
        </ModernSelect></label>
        <label className="block">Luz de las imágenes y del vídeo<ModernSelect portalContainer={menuContainer} popoverZIndex={200} value={site.lighting} disabled={disabled}
          onChange={e => patch({ lighting: e.target.value as GeographicSite['lighting'] })}>
          {LIGHTING_PRESETS.map(light => <option key={light} value={light}>{LIGHTING_LABELS[light]}</option>)}
        </ModernSelect></label>
        <p className="text-xs text-ink-soft">Las imágenes ya creadas no cambian. Al generar nuevas vistas, elige también esta luz en «Diseñar con IA».</p>
        {site.scenario === 'reform' && <p className="text-xs">La reforma necesitará indicar qué elementos se conservan antes de simular sus etapas.</p>}
      </>;
  const designControls = site && <>
    <SiteAdjustmentControl label="Tamaño del diseño" value={(site.planScale ?? 1) * 100} min={25} max={500} step={5} unit="%" disabled={disabled}
      onChange={n => patch({ planScale: n / 100 })} />
    <SiteAdjustmentControl label="Giro del diseño" value={site.rotationDeg} min={-180} max={180} step={1} unit="°" disabled={disabled}
      onChange={n => patch({ rotationDeg: n })} />
    <p className="text-xs text-ink-soft">100 % corresponde al tamaño original. Este ajuste cambia el encaje en la parcela y se aplica a las vistas y al vídeo.</p>
  </>;
  return <>
    {site && url ? <GeographicSiteMap key={site.assetKey} document={doc} site={site} url={url} disabled={disabled} onChange={patch}
      locationControls={locationControls} designControls={designControls} videoControls={videoControls} />
      : <div className="grid flex-1 gap-5 p-6 lg:grid-cols-[1fr_360px]"><div className="flex min-h-80 items-center justify-center rounded-xl bg-stone-100 text-sm">{site ? 'Abriendo la fotografía…' : 'Carga la fotografía de tu parcela para empezar.'}</div><div>{locationControls}</div></div>}
    <footer className="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-white px-6 py-4">
      <div className="min-w-0 flex-1 text-sm">
        <p className={`font-medium ${dirty ? 'text-amber-800' : 'text-emerald-800'}`}>{!site ? 'Parcela pendiente' : dirty ? 'Cambios sin guardar' : site.confirmed ? 'Ubicación confirmada para el vídeo' : 'Ajustes guardados'}</p>
        {message ? <p role="status" className="mt-1 text-xs text-ink-soft">{message}</p>
          : <p className="mt-1 text-xs text-ink-soft">{site?.confirmed && !dirty
            ? 'El encaje está listo. Continúa con la revisión o abre los vídeos con tus imágenes.'
            : 'Revisa el tapado y la orientación del acceso antes de confirmar. Al guardar se crea una revisión del plano.'}</p>}
      </div>
      {!readOnly && <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || !site || !dirty} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-stone-50" onClick={() => save(false)}>Guardar cambios</button>
        <button type="button" disabled={pending || !site || (site.confirmed && !dirty)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700" onClick={() => save(true)}>Confirmar para el vídeo</button>
      </div>}
      {site && <GeographicSiteNextSteps {...nextSteps} projectId={projectId} readOnly={readOnly} confirmed={site.confirmed && !dirty} />}
    </footer>
  </>;
}
