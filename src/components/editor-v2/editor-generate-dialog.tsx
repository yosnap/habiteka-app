'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { RenderCapture } from '@/lib/editor-document/render-view';
import type { EditorDocument } from '@/lib/editor-document/schema';
import {
  defaultRenderDesignOptions,
  RENDER_ADDITION_LABELS,
  RENDER_VIEW_LABELS,
  type RenderDesignOptions,
  type RenderGeneratedResult,
} from '@/lib/editor-document/render-design-options';
import { Button } from '@/components/ui/button';
import { ModernSelect } from '@/components/ui/modern-select';
import { DESIGN_SPACE_KINDS, type DesignSpaceKind } from '@/lib/design-space-kind';
import { StyleGallery } from '@/components/canvas/style-gallery';
import type { Estilo } from '@/lib/contracts';
import type {
  NativeDesignProposal,
  NativeDesignSelection,
} from '@/lib/editor-document/native-design-proposal';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import RenderOptionsControls from './render-options-controls';
import { runRenderBatch } from './render-batch';
import { RenderLivePreview, type PreviewRender } from './render-live-preview';
import { RenderInstructionField } from './render-instruction-field';

interface EditorGenerateDialogProps {
  document?: EditorDocument;
  capture?: RenderCapture;
  onPreview?: PreviewRender;
  onPrepare?: (options: RenderDesignOptions) => Promise<RenderCapture[]>;
  onEstimate?: (viewCount: number) => Promise<{ estimatedUsd: number; model: string }>;
  onGenerate: (input: {
    estilo: Estilo;
    objetivo: string;
    promptLibre: string;
    options: RenderDesignOptions;
  }) => Promise<NativeDesignProposal>;
  onRender: (input: {
    estilo: Estilo;
    objetivo: string;
    promptLibre: string;
    capture?: RenderCapture;
    options?: RenderDesignOptions;
    batchId?: string;
    referenceDesignId?: string;
  }) => Promise<RenderGeneratedResult>;
  onApply: (proposal: NativeDesignProposal, selection: NativeDesignSelection) => void | Promise<void>;
  spaceKind?: DesignSpaceKind;
  onSpaceKindChange: (spaceKind: DesignSpaceKind) => void;
  onClose: () => void;
}

export function EditorGenerateDialog({
  document,
  capture,
  onPreview,
  onPrepare,
  onGenerate,
  onRender,
  onApply,
  spaceKind,
  onSpaceKindChange,
  onClose,
}: EditorGenerateDialogProps) {
  const [estilo, setEstilo] = useState<Estilo>('moderno');
  const [objetivo, setObjetivo] = useState('');
  const [promptLibre, setPromptLibre] = useState('');
  const [options, setOptions] = useState<RenderDesignOptions>(() => defaultRenderDesignOptions());
  const [prepared, setPrepared] = useState<RenderCapture[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [results, setResults] = useState<RenderGeneratedResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stopRequested = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<NativeDesignProposal | null>(null);
  const [selection, setSelection] = useState<NativeDesignSelection | null>(null);
  const [mode, setMode] = useState<'choose' | 'renders' | 'proposal'>('choose');
  const [largePreview, setLargePreview] = useState<{ src: string; label: string } | null>(null);
  const preparedReady = prepared.length > 0;
  const [applied, setApplied] = useState(false);
  const [intent, setIntent] = useState<'image' | 'editable'>('image');
  const renderableCaptures = useMemo(
    () => prepared.slice(0, options.views.length),
    [prepared, options.views.length],
  );

  const invalidatePrepared = () => {
    setPrepared([]);
    setResults([]);
    setBatchId(null);
    setError(null);
  };
  const changeOptions = (next: RenderDesignOptions) => {
    setOptions(next);
    invalidatePrepared();
  };
  const changeContext = (setter: (value: string) => void, value: string) => {
    setter(value);
    invalidatePrepared();
  };
  const prepare = async () => {
    if (!onPrepare) {
      setError(
        'La preparación de vistas no está conectada a este editor. No se ha creado ningún preview.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    setResults([]);
    setBatchId(crypto.randomUUID());
    try {
      const captures = await onPrepare(options);
      if (!captures.length) throw new Error('No se pudo preparar ninguna vista 2D/3D.');
      setPrepared(captures);
      setMode('renders');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron preparar las vistas.');
    } finally {
      setBusy(false);
    }
  };
  const renderBatch = async () => {
    if (!preparedReady || busy) return;
    setBusy(true);
    stopRequested.current = false;
    setStopping(false);
    setError(null);
    const stableBatchId = batchId ?? crypto.randomUUID();
    if (!batchId) setBatchId(stableBatchId);
    const state = await runRenderBatch({
      items: renderableCaptures,
      initialResults: results,
      render: (capture, _index, referenceDesignId) =>
        onRender({
          estilo,
          objetivo: objetivo.trim(),
          promptLibre: promptLibre.trim(),
          capture,
          options,
          batchId: stableBatchId,
          ...(referenceDesignId ? { referenceDesignId } : {}),
        }),
      shouldStop: () => stopRequested.current,
      onResult: (_result, _index, nextResults) =>
        setResults(
          nextResults.filter((result): result is RenderGeneratedResult => Boolean(result)),
        ),
    });
    setResults(state.results.filter((result): result is RenderGeneratedResult => Boolean(result)));
    if (state.error)
      setError(
        state.error instanceof Error
          ? state.error.message
          : 'No se pudo completar el lote de renders.',
      );
    setBusy(false);
    setStopping(false);
    stopRequested.current = false;
  };
  const generateProposal = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await onGenerate({
        estilo,
        objetivo: objetivo.trim(),
        promptLibre: promptLibre.trim(),
        options,
      });
      setProposal(next);
      setSelection({
        walls: true,
        floors: true,
        stairs: true,
        ramps: true,
        columns: true,
        furniture: next.furniture.map((_, index) => index),
      });
      setMode('proposal');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar el diseño.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Diseñar el espacio"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onClose();
      }}
    >
      <div className="bg-surface flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-card border border-line p-4 shadow-2xl sm:p-6">
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-primary text-xs font-semibold uppercase tracking-[.18em]">
              Estudio de diseño
            </p>
            <h2 className="text-ink mt-1 text-xl font-semibold">
              {mode === 'proposal'
                ? 'Propuesta editable'
                : mode === 'renders'
                  ? 'Previsualiza tus vistas'
                  : 'Diseñar el espacio'}
            </h2>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted-foreground rounded-full px-2 text-xl hover:bg-muted"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto pr-1">
        {mode === 'proposal' && proposal ? (
          <><p role="status" className="mt-4 rounded-lg border border-line bg-canvas p-3 text-sm">
            {applied ? 'Cambios aplicados al plano. Puedes verlos al cerrar y deshacerlos con ⌘Z / Ctrl+Z. Guarda el plano para sincronizarlos.'
              : 'Propuesta lista. El plano aún no ha cambiado: revisa los acabados y pulsa «Aplicar al plano».'}
          </p><fieldset disabled={applied || busy}><ProposalPreview proposal={proposal} selection={selection!} onChange={setSelection} /></fieldset></>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Qué quieres crear">
              {([['image', 'Crear imágenes', 'Render del diseño, sin modificar el plano.'], ['editable', 'Cambiar acabados y muebles', 'Revisa una propuesta y aplícala al plano.']] as const).map(([value, label, hint]) => (
                <button key={value} type="button" disabled={busy} aria-pressed={intent === value}
                  className={`rounded-lg border p-3 text-left ${intent === value ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700' : 'border-line bg-surface text-ink'}`}
                  onClick={() => { setIntent(value); invalidatePrepared(); setMode('choose'); }}>
                  <strong className="block text-sm">{label}</strong><span className="block text-xs">{hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <div>
                <p className="text-ink-soft text-sm">
                  {intent === 'image' ? '1. Configura el aspecto. 2. Revisa las vistas de referencia (sin IA). 3. Genera las imágenes con IA. El plano no cambia.' : 'La IA propondrá acabados y objetos permitidos del catálogo. No crea una imagen: revisa el resultado y pulsa Aplicar al plano. Consultar la IA puede consumir créditos; no garantiza que haya objetos que encajen.'}
                </p>
                {intent === 'image' && !capture && !prepared.length && (
                  <p className="bg-canvas text-ink-soft mt-3 rounded-control border border-line p-3 text-xs">
                    Este flujo necesita preparar una captura 3D. Para conservar una cámara concreta,
                    vuelve al editor 3D y selecciona una vista antes de preparar.
                  </p>
                )}
                {prepared.length > 0 && (
                  <div className={`mt-3 grid gap-2 ${prepared.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                    {prepared.map((item, index) => (
                      <figure
                        key={`${item.view.preset}-${index}`}
                        className="overflow-hidden rounded-card border border-line"
                      >
                        <button
                          type="button"
                          className="w-full cursor-zoom-in"
                          onClick={() =>
                            setLargePreview({
                              src: item.dataUrl,
                              label: RENDER_VIEW_LABELS[options.views[index] ?? 'current'],
                            })
                          }
                          aria-label={`Abrir ${RENDER_VIEW_LABELS[options.views[index] ?? 'current']} en grande`}
                        >
                          <img
                            src={item.dataUrl}
                            alt={`Preview ${RENDER_VIEW_LABELS[options.views[index] ?? 'current']}`}
                            className="aspect-video w-full object-contain"
                          />
                        </button>
                        <figcaption className="text-ink-soft p-2 text-xs">
                          {RENDER_VIEW_LABELS[options.views[index] ?? 'current']} · pulsa para
                          ampliar
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {(capture || onPreview) && !prepared.length && (
                  <RenderLivePreview capture={capture} lighting={options.lighting} view={options.views[0] ?? 'current'} onPreview={onPreview}
                    onExpand={(src, label) => setLargePreview({ src, label })} />
                )}
                <RenderOptionsControls
                  editable={intent === 'editable'}
                  document={document}
                  options={options}
                  onChange={changeOptions}
                  disabled={busy}
                />
              </div>
              <div className="space-y-3">
                <label className="text-ink-soft flex flex-col gap-1 text-sm">
                  Tipo de espacio
                  <ModernSelect
                    value={spaceKind ?? ''}
                    disabled={busy}
                    onChange={(event) => {
                      onSpaceKindChange(event.target.value as DesignSpaceKind);
                      invalidatePrepared();
                    }}
                  >
                    <option value="" disabled>
                      Selecciona el espacio
                    </option>
                    {DESIGN_SPACE_KINDS.map((kind) => (
                      <option key={kind.value} value={kind.value}>
                        {kind.label}
                      </option>
                    ))}
                  </ModernSelect>
                </label>
                <label className="text-ink-soft flex flex-col gap-1 text-sm">
                  Objetivo (opcional)
                  <input
                    value={objetivo}
                    disabled={busy}
                    maxLength={200}
                    onChange={(event) => changeContext(setObjetivo, event.target.value)}
                    placeholder="Ej. un espacio cómodo, despejado y acogedor"
                    className="border-line bg-surface rounded-control border px-2 py-1.5 text-sm"
                  />
                </label>
                <RenderInstructionField value={promptLibre} disabled={busy} onChange={(value) => changeContext(setPromptLibre, value)} />
                <div className="text-ink-soft text-sm">
                  Estilo
                  <StyleGallery
                    value={estilo}
                    onChange={(value) => {
                      setEstilo(value);
                      invalidatePrepared();
                    }}
                    disabled={busy}
                  />
                </div>
                <div className="bg-canvas rounded-card border border-line p-3 text-xs">
                  <p className="text-ink font-medium">Permisos efectivos</p>
                  <p className="text-ink-soft mt-1">
                    {intent === 'image' && <>{options.lighting === 'daylight'
                      ? 'Día'
                      : options.lighting === 'warm'
                        ? 'Atardecer'
                        : 'Noche'} · </>}
                    Libertad{' '}
                    {options.freedom === 'strict'
                      ? 'estricta, sin añadir objetos'
                      : options.freedom === 'controlled'
                        ? `controlada (${options.additions.length ? options.additions.map((addition) => RENDER_ADDITION_LABELS[addition]).join(', ') : 'sin categorías'})`
                        : 'libre, solo decoración sin construcción'}{' '}
                    ·{' '}
                    {options.placement === 'selected'
                      ? `${options.regions.length} zona(s) permitida(s)`
                      : 'toda la planta'}{' '}
                    {intent === 'image' && <> · {options.views.length} vista(s).</>}
                  </p>
                  <p className="text-ink-soft mt-2">{intent === 'image' ? 'Revisa las vistas de referencia antes de generar las imágenes.' : 'Los cambios no se aplican hasta que pulses Aplicar al plano. No se modifica la geometría.'}</p>
                </div>
              </div>
            </div>
            {mode === 'renders' && results.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-ink text-sm font-medium">Galería del lote</h3>
                  <span className="text-muted-foreground text-xs">
                    {results.length}/{renderableCaptures.length} completadas
                  </span>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((result, index) => (
                    <figure
                      key={`${result.id ?? index}-${index}`}
                      className="overflow-hidden rounded-card border border-line"
                    >
                      <button
                        type="button"
                        className="w-full cursor-zoom-in"
                        onClick={() =>
                          setLargePreview({
                            src: result.assetUrl,
                            label: RENDER_VIEW_LABELS[options.views[index] ?? 'current'],
                          })
                        }
                        aria-label={`Abrir resultado ${RENDER_VIEW_LABELS[options.views[index] ?? 'current']} en grande`}
                      >
                        <img
                          src={result.assetUrl}
                          alt={`Render ${RENDER_VIEW_LABELS[options.views[index] ?? 'current']}`}
                          className="aspect-video w-full object-contain"
                        />
                      </button>
                      <figcaption className="text-ink-soft p-2 text-xs">
                        {RENDER_VIEW_LABELS[options.views[index] ?? 'current']}
                        {result.generation && (
                          <>
                            {' '}
                            · {result.generation.provider}/{result.generation.model}
                          </>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="text-destructive mt-4 text-sm" role="alert">
            {error}
          </p>
        )}
        {mode !== 'proposal' && <p className="text-ink-soft mt-4 text-xs">
          {intent === 'image' ? 'Ver vistas de referencia toma capturas del modelo 3D con los ángulos elegidos. Todavía no genera imágenes con IA ni modifica el plano.' : 'Estricto cambia solo acabados. Controlado permite únicamente las categorías marcadas. Libre permite decoración del catálogo, nunca cambios de construcción. Las zonas limitan los objetos nuevos, no los acabados.'}
        </p>}
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          {mode === 'proposal' ? (
            <>
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                {applied ? 'Ver plano actualizado' : 'Descartar propuesta'}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || applied}
                onClick={async () => {
                  setBusy(true); setError(null);
                  try { await onApply(proposal!, selection!); setApplied(true); }
                  catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron aplicar los cambios.'); }
                  finally { setBusy(false); }
                }}
              >
                {applied ? 'Aplicado' : busy ? 'Aplicando…' : 'Aplicar al plano'}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onClose}>
                Cancelar
              </Button>
              {intent === 'editable' && <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy || !spaceKind}
                onClick={() => void generateProposal()}
              >
                Proponer acabados y muebles con IA
              </Button>}
              {intent === 'image' && onPrepare && !preparedReady && (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !spaceKind || !options.views.length}
                  onClick={() => void prepare()}
                >
                  {busy ? 'Preparando…' : 'Ver vistas de referencia'}
                </Button>
              )}
              {intent === 'image' && preparedReady && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!busy}
                    onClick={() => {
                      stopRequested.current = true;
                      setStopping(true);
                    }}
                  >
                    {stopping ? 'Parando tras actual…' : 'Parar tras actual'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || results.length >= renderableCaptures.length}
                    onClick={() => void renderBatch()}
                  >
                    {busy
                      ? `${Math.min(results.length + 1, renderableCaptures.length)}/${renderableCaptures.length} renderizando…`
                      : results.length
                        ? 'Reintentar pendientes'
                        : 'Generar imágenes con IA'}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
        {largePreview && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Vista ampliada: ${largePreview.label}`}
            onClick={() => setLargePreview(null)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') { event.stopPropagation(); setLargePreview(null); }
            }}
          >
            <div
              className="bg-surface max-h-[92vh] max-w-6xl rounded-card border border-line p-2 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={largePreview.src}
                alt={largePreview.label}
                className="max-h-[86vh] max-w-full object-contain"
              />
              <p className="text-ink-soft px-2 pt-2 text-xs">
                {largePreview.label} · cerrar para volver
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProposalPreview({
  proposal,
  selection,
  onChange,
}: {
  proposal: NativeDesignProposal;
  selection: NativeDesignSelection;
  onChange: (selection: NativeDesignSelection) => void;
}) {
  const materialLabel = (id: string) => surfaceMaterial(id)?.label ?? id;
  const toggle = (key: Exclude<keyof NativeDesignSelection, 'furniture'>) =>
    onChange({ ...selection, [key]: !selection[key] });
  const toggleFurniture = (index: number) =>
    onChange({
      ...selection,
      furniture: selection.furniture.includes(index)
        ? selection.furniture.filter((value) => value !== index)
        : [...selection.furniture, index],
    });
  return (
    <div className="text-ink mt-5 space-y-3 text-sm">
      <p className="bg-canvas rounded-control border border-line p-3">{proposal.summary}</p>
      <div className="grid grid-cols-2 gap-2 rounded-control border border-line p-3 text-xs">
        {(['walls', 'floors', 'stairs', 'ramps', 'columns'] as const).map((key) => (
          <Choice key={key} checked={selection[key]} onChange={() => toggle(key)}>
            {key === 'walls'
              ? 'Muros'
              : key === 'floors'
                ? 'Suelos'
                : key === 'stairs'
                  ? 'Escaleras'
                  : key === 'ramps'
                    ? 'Rampas'
                    : 'Columnas'}
            : {materialLabel(proposal.materials[key])}
          </Choice>
        ))}
      </div>
      <div>
        <p className="font-medium">Mobiliario y vegetación</p>
        {proposal.furniture.length ? (
          <ul className="text-ink-soft mt-1 space-y-1">
            {proposal.furniture.map((item, index) => (
              <li key={`${item.catalogId}-${index}`}>
                <Choice
                  checked={selection.furniture.includes(index)}
                  onChange={() => toggleFurniture(index)}
                >
                  {getFurnitureCatalogEntry(item.catalogId)?.label ?? item.catalogId}
                  {item.reason ? ` · ${item.reason}` : ''}
                </Choice>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft mt-1">
            La propuesta se concentra en acabados; no añade objetos al plano.
          </p>
        )}
      </div>
      <p className="text-ink-soft text-xs">
        Al aplicar solo se cambian acabados y se añaden los objetos listados. La geometría se
        conserva intacta.
      </p>
    </div>
  );
}
function Choice({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className={checked ? '' : 'opacity-50'}>
      <input type="checkbox" checked={checked} onChange={onChange} className="mr-1 align-middle" />
      {children}
    </label>
  );
}

export default EditorGenerateDialog;
