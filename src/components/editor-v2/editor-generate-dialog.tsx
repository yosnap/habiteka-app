'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Camera, Sofa } from 'lucide-react';
import { CheckToggle } from '@/components/ui/check-toggle';
import { ExistingRenderReview } from './existing-render-review';
import { RenderReferenceLibrary } from './render-reference-library';
import { requiredReferencePreset, type ReferencePreset } from '@/lib/editor-document/render-reference-compatibility';
import { captureFileName } from '@/lib/editor-document/capture-file-name';
import type { RenderCapture } from '@/lib/editor-document/render-view';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import {
  defaultRenderDesignOptions,
  isInteriorRenderMode,
  renderItemCount,
  renderPassCount,
  zoneCompositeActive,
  RENDER_ADDITIONS,
  RENDER_ADDITION_LABELS,
  RENDER_VIEW_LABELS,
  renderBatchSettingsKey,
  type RenderDesignOptions,
  type RenderGeneratedResult,
} from '@/lib/editor-document/render-design-options';
import {
  roomInteriorCameras,
  selectedInteriorCameras,
} from '@/lib/editor-document/room-interior-cameras';
import { Button } from '@/components/ui/button';
import { ModernSelect } from '@/components/ui/modern-select';
import { DESIGN_SPACE_KINDS, type DesignSpaceKind } from '@/lib/design-space-kind';
import { ESTILOS } from '@/lib/design-options';
import type { Estilo } from '@/lib/contracts';
import type {
  NativeDesignProposal,
  NativeDesignSelection,
} from '@/lib/editor-document/native-design-proposal';
import { EditorQualityGate, type EditorQualityState } from './editor-quality-gate';
import type { QualityVerdict } from '@/lib/quality-verdict';
import { needsQualityConfirmation } from '@/lib/quality-messages';
import RenderOptionsControls from './render-options-controls';
import { renderBatchFailureMessage, runRenderBatch } from './render-batch';
import { RenderLivePreview, type PreviewRender } from './render-live-preview';
import { PlanPreview2d } from './plan-preview-2d';
import { ProposalPreview } from './proposal-preview';
import { RenderInstructionField } from './render-instruction-field';
import { useMountEffect } from '@/lib/use-mount-effect';
import { ZoneOverlayImage } from './zone-overlay-image';
import { RenderCostEstimate } from './render-cost-estimate';
import { DesignScopePicker } from './design-scope-picker';
import { buildingDesignStyle } from '@/lib/editor-document/design-scope';
import { designMaterialPalette } from '@/lib/editor-document/design-material-palette';
import { DroneReferenceField } from './drone-reference-field';
import { RenderPresetControls } from './render-preset-controls';
import { GeneratedRenderGallery } from './generated-render-gallery';
import { autoGenerateInteriorRoomIds, type AutoGenerateRequest } from './auto-generate-request';
import { DesignPreviewDialog, EditorDesignDialogFrame } from './editor-design-dialog-frame';

interface EditorGenerateDialogProps {
  projectId?: string; zoneId?: string | null;
  preferencesOwner?: string;
  document?: EditorDocument;
  capture?: RenderCapture;
  onPreview?: PreviewRender;
  onPrepare?: (options: RenderDesignOptions) => Promise<RenderCapture[]>;
  /**
   * Si la escena 3D ya puede capturar. Falso mientras carga: el diálogo se abre
   * igualmente (cargar el 3D lleva decenas de segundos) y avisa de que está
   * esperando en vez de dejar botones mudos. Preparar no se bloquea: la espera
   * la hace `onPrepare`, con plazo.
   */
  sceneReady?: boolean;
  onEstimate?: (viewCount: number) => Promise<{ estimatedUsd: number; model: string }>;
  /** Evaluación de calidad del plano guardado; sin coste de imagen. */
  onEvaluateQuality?: (acknowledgeImport?: boolean) => Promise<QualityVerdict | null>;
  /** Incidencias localizables bajo la tarjeta de calidad; las pinta el editor. */
  renderPlanIssues?: (onRepaired: () => void) => ReactNode;
  onGenerate: (input: {
    estilo: Estilo;
    objetivo: string;
    promptLibre: string;
    options: RenderDesignOptions;
    qualityAck: boolean;
  }) => Promise<NativeDesignProposal>;
  onRender: (input: {
    estilo: Estilo;
    objetivo: string;
    promptLibre: string;
    capture?: RenderCapture;
    options?: RenderDesignOptions;
    batchId?: string;
    qualityAck: boolean;
    styleAnchor?: boolean;
    orthophotoDataUrl?: string;
    existingImageDataUrl?: string;
    designReferenceId?: string;
  }) => Promise<RenderGeneratedResult>;
  onApply: (proposal: NativeDesignProposal, selection: NativeDesignSelection) => void | Promise<void>;
  onCreateDesignZone?: (name: string, polygon: Point[]) => string;
  onRenameDesignZone?: (id: string, name: string) => void;
  onReshapeDesignZone?: (id: string, polygon: Point[]) => void;
  onRemoveDesignZone?: (id: string) => void;
  spaceKind?: DesignSpaceKind;
  onSpaceKindChange: (spaceKind: DesignSpaceKind) => void;
  /**
   * Arranque preconfigurado cuando se llega desde el asistente: estilo ya
   * elegido y vistas interiores de todas las estancias habitables marcadas.
   */
  initialSetup?: Partial<AutoGenerateRequest>;
  /** Paso con el que se abre el estudio: diseñar el plano (desde la planta) o crear imágenes (desde amueblado y 3D). */
  initialIntent?: 'image' | 'editable';
  onClose: () => void;
}

/** Punto de partida de las imágenes de un proyecto ya diseñado: decoración controlada con todas las categorías. */
const DRESSED_IMAGE_OPTIONS = { freedom: 'controlled', additions: [...RENDER_ADDITIONS] } as const satisfies Pick<RenderDesignOptions, 'freedom' | 'additions'>;

export function EditorGenerateDialog({
  projectId, zoneId = null,
  preferencesOwner,
  document,
  capture,
  onPreview,
  onPrepare,
  sceneReady = true,
  onEvaluateQuality,
  renderPlanIssues,
  onGenerate,
  onRender,
  onApply,
  onCreateDesignZone,
  onRenameDesignZone,
  onReshapeDesignZone,
  onRemoveDesignZone,
  onEstimate,
  spaceKind,
  onSpaceKindChange,
  initialSetup,
  initialIntent,
  onClose,
}: EditorGenerateDialogProps) {
  const establishedStyle = document ? buildingDesignStyle(document) : undefined;
  // El 3D editable es la guía: las imágenes lo visten como una casa terminada (alfombras, muebles, cortinas) sin tocar
  // muros ni huecos. Quien quiera una copia fiel del 3D puede bajar la libertad a «Estricto».
  const hasDesign = (document?.furniture.length ?? 0) > 0;
  const materialPalette = document ? designMaterialPalette(document) : undefined;
  const [estilo, setEstilo] = useState<Estilo>(establishedStyle ?? initialSetup?.estilo ?? 'moderno');
  const [objetivo, setObjetivo] = useState('');
  const [promptLibre, setPromptLibre] = useState('');
  const [options, setOptions] = useState<RenderDesignOptions>(() => {
    if (initialSetup?.continuation) return initialSetup.continuation.options;
    const base = { ...defaultRenderDesignOptions(), ...(initialSetup?.lighting ? { lighting: initialSetup.lighting } : {}) };
    if (!document) return base;
    // Un plano sin muebles con «Estricto» devuelve estancias vacías: no es lo
    // que espera quien viene del asistente a ver su casa amueblada.
    const freedom = hasDesign ? DRESSED_IMAGE_OPTIONS.freedom : ('free' as const);
    const additions = hasDesign ? DRESSED_IMAGE_OPTIONS.additions : base.additions;
    if (!initialSetup?.interiorRooms) return { ...base, freedom, additions };
    return {
      ...base,
      freedom,
      additions,
      interiorRoomIds: autoGenerateInteriorRoomIds(roomInteriorCameras(document), initialSetup.singleInterior),
    };
  });
  const optionsByIntent = useRef<{ image: RenderDesignOptions | null; editable: RenderDesignOptions | null }>({
    image: null, editable: null,
  });
  /**
   * Las vistas interiores por estancia son, por definición, habitaciones: pedir
   * además el tipo de espacio solo servía para dejar el botón de preparar
   * desactivado sin decir por qué.
   */
  useMountEffect(() => {
    if (initialSetup?.interiorRooms && !spaceKind) onSpaceKindChange('interior');
  });
  const [prepared, setPrepared] = useState<RenderCapture[]>([]);
  const [batchId, setBatchId] = useState<string | null>(initialSetup?.continuation?.batchId ?? null);
  // Apagada por defecto: la ancla da coherencia de estilo, pero en pruebas puede arrastrar geometría de otra cámara.
  const [styleAnchor, setStyleAnchor] = useState(false);
  const [orthophotoDataUrl, setOrthophotoDataUrl] = useState('');
  const [referenceIds, setReferenceIds] = useState<Partial<Record<ReferencePreset, string>>>({});
  const [referenceNotice, setReferenceNotice] = useState('');
  const [results, setResults] = useState<Array<RenderGeneratedResult | undefined>>([]);
  const completedCount = results.filter(Boolean).length;
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stopRequested = useRef(false);
  const [error, setError] = useState<string | null>(initialSetup?.error ?? null);
  const [proposal, setProposal] = useState<NativeDesignProposal | null>(null);
  const [selection, setSelection] = useState<NativeDesignSelection | null>(null);
  const [mode, setMode] = useState<'choose' | 'renders' | 'proposal'>('choose');
  const [largePreview, setLargePreview] = useState<{ src: string; label: string; maskSrc?: string } | null>(null);
  // Un precio por número de generaciones y diálogo: cambiar opciones no repite la consulta.
  const [estimates] = useState(() => new Map<number, Promise<{ estimatedUsd: number; model: string }>>());
  const cachedEstimate = onEstimate ? (passes: number) => {
    let pending = estimates.get(passes);
    if (!pending) {
      pending = onEstimate(passes);
      estimates.set(passes, pending);
      pending.catch(() => estimates.delete(passes));
    }
    return pending;
  } : undefined;
  const preparedReady = prepared.length > 0;
  // Las vistas de referencia son capturas del 3D editable: se descargan tal cual, sin IA ni créditos.
  const fileNameAt = (index: number) => captureFileName(labelAt(index), index);
  const downloadCapture = (item: RenderCapture, index: number) => {
    const link = window.document.createElement('a');
    link.href = item.dataUrl; link.download = fileNameAt(index);
    window.document.body.appendChild(link); link.click(); link.remove();
  };
  const downloadAll = () => prepared.forEach((item, index) => setTimeout(() => downloadCapture(item, index), index * 250));
  const [applied, setApplied] = useState(false);
  // Un plano sin muebles empieza por diseñarlo; las imágenes llegan después, sobre ese diseño.
  const [intent, setIntent] = useState<'image' | 'editable'>(() => initialIntent
    ?? (document && !hasDesign && !initialSetup?.continuation && !initialSetup?.interiorRooms ? 'editable' : 'image'));
  const [quality, setQuality] = useState<EditorQualityState>({
    quality: null,
    ack: false,
    blocked: false,
  });
  // Mensaje del servidor cuando ha cortado pidiendo confirmación expresa: la
  // tarjeta con la casilla se enseña aunque el veredicto local dijera otra cosa.
  const [serverConfirm, setServerConfirm] = useState<string | null>(null);
  /** Un fallo de generación: si el servidor pide confirmar, se abre la casilla. */
  const showFailure = (message: string) => {
    setError(message);
    setServerConfirm(needsQualityConfirmation(message) ? message : null);
  };
  // El servidor vuelve a evaluar y exige lo mismo; esto evita el viaje inútil.
  const qualityBlocked =
    quality.blocked || (quality.quality?.decision === 'confirm' && !quality.ack);
  const itemCount = renderItemCount(options);
  const interiorMode = isInteriorRenderMode(options);
  // Un botón desactivado sin explicación deja al usuario atascado: el motivo se
  // enseña al lado, con la acción concreta que lo desbloquea.
  const prepareBlockedReason = !spaceKind
    ? 'Elige antes el tipo de espacio.'
    : !itemCount
      ? interiorMode
        ? 'Marca al menos una estancia.'
        : 'Marca al menos un ángulo.'
      : null;
  const proposalBlockedReason = !spaceKind
    ? 'Elige antes el tipo de espacio.'
    : options.designScope === 'rooms' && !options.designRoomIds.length
      ? 'Marca al menos una estancia para diseñar.'
    : options.designScope === 'zone' && !options.designZoneId
      ? 'Dibuja o elige una zona de diseño.'
    : options.freedom !== 'strict' && options.designScope !== 'zone' &&
      options.placement === 'selected' && !options.regions.length
      ? 'Marca al menos una zona permitida para colocar objetos.'
    : qualityBlocked
      ? 'Confirma antes el aviso de calidad del plano.'
      : null;
  // Nombre de cada imagen del lote: la estancia en modo interior, el ángulo si no.
  const interiorNames = useMemo(
    () =>
      document && interiorMode
        ? selectedInteriorCameras(roomInteriorCameras(document), options.interiorRoomIds).map(
            (room) => room.name,
          )
        : [],
    [document, interiorMode, options.interiorRoomIds],
  );
  const labelAt = (index: number) =>
    interiorMode
      ? (interiorNames[index] ?? `Estancia ${index + 1}`)
      : RENDER_VIEW_LABELS[(prepared[index]?.view.preset === 'custom' ? 'current' : prepared[index]?.view.preset) ?? options.views[index] ?? 'current'];
  const renderableCaptures = useMemo(
    () => prepared.slice(0, itemCount),
    [prepared, itemCount],
  );

  const invalidatePrepared = (resetBatch = true) => {
    setPrepared([]);
    setResults([]);
    if (resetBatch) setBatchId(null);
    setError(null);
  };
  const changeOptions = (next: RenderDesignOptions) => {
    setReferenceIds({});
    setReferenceNotice('');
    setOptions(intent === 'editable' && (next.freedom === 'strict' || next.designScope === 'zone')
      ? { ...next, placement: 'all', regions: [] } : next);
    if (intent === 'editable' && next.designScope !== 'all' && establishedStyle)
      setEstilo(establishedStyle);
    // Activar las vistas interiores ya dice qué clase de espacio es.
    if (isInteriorRenderMode(next) && !spaceKind) onSpaceKindChange('interior');
    invalidatePrepared(intent !== 'image' || renderBatchSettingsKey(options) !== renderBatchSettingsKey(next));
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
    setBatchId(batchId ?? crypto.randomUUID());
    try {
      const captures = await onPrepare(options);
      if (!captures.length) throw new Error('No se pudo preparar ninguna vista 2D/3D.');
      setPrepared(captures);
      setReferenceNotice('');
      setMode('renders');
    } catch (cause) {
      showFailure(cause instanceof Error ? cause.message : 'No se pudieron preparar las vistas.');
    } finally {
      setBusy(false);
    }
  };
  const renderBatch = async () => {
    if (!preparedReady || busy || qualityBlocked) return;
    setBusy(true);
    stopRequested.current = false;
    setStopping(false);
    setError(null);
    const stableBatchId = batchId ?? crypto.randomUUID();
    if (!batchId) setBatchId(stableBatchId);
    const state = await runRenderBatch({
      items: renderableCaptures,
      initialResults: results,
      render: (capture) =>
        onRender({
          estilo,
          objetivo: objetivo.trim(),
          promptLibre: promptLibre.trim(),
          capture,
          options,
          batchId: stableBatchId,
          qualityAck: quality.ack,
          designReferenceId: referenceIds[requiredReferencePreset(capture.view, options) ?? 'top'],
          ...(['drone', 'isometric', 'exterior'].includes(capture.view.preset) ? { orthophotoDataUrl } : {}),
          ...((styleAnchor || options.redesignInterior || options.redesignFixed) && renderableCaptures.length > 1 ? { styleAnchor: true } : {}),
        }),
      shouldStop: () => stopRequested.current,
      continueOnError: (error) => error instanceof Error && 'code' in error && error.code === 'render_rejected',
      onResult: (_result, _index, nextResults) => setResults(nextResults),
    });
    setResults(state.results);
    const failureMessage = renderBatchFailureMessage(state, labelAt);
    if (failureMessage) showFailure(failureMessage);
    setBusy(false);
    setStopping(false);
    stopRequested.current = false;
  };
  const reviewExisting = async (index: number, existingImageDataUrl: string) => {
    const capture = renderableCaptures[index];
    if (!capture || busy || qualityBlocked) return;
    setBusy(true); setError(null);
    const stableBatchId = batchId ?? crypto.randomUUID(); setBatchId(stableBatchId);
    try {
      const result = await onRender({ estilo, objetivo: objetivo.trim(), promptLibre: promptLibre.trim(), capture,
        options, batchId: stableBatchId, qualityAck: quality.ack, existingImageDataUrl,
        designReferenceId: referenceIds[requiredReferencePreset(capture.view, options) ?? 'top'],
        ...(['drone', 'isometric', 'exterior'].includes(capture.view.preset) ? { orthophotoDataUrl } : {}) });
      setResults(previous => { const next = [...previous]; next[index] = result; return next; });
    } finally { setBusy(false); }
  };
  const generateProposal = async () => {
    if (qualityBlocked) return;
    setBusy(true);
    setError(null);
    try {
      const next = await onGenerate({
        estilo,
        objetivo: objetivo.trim(),
        promptLibre: promptLibre.trim(),
        options: options.designScope === 'zone' ? { ...options, placement: 'all', regions: [] } : options,
        qualityAck: quality.ack,
      });
      setProposal(next);
      setSelection({
        walls: true,
        floors: true,
        stairs: true,
        ramps: true,
        columns: true,
        furniture: next.furniture.map((_, index) => index),
        kitchens: next.kitchens?.map((_, index) => index),
        fixedFinishes: next.fixedFinishes?.map((_, index) => index),
      });
      setMode('proposal');
    } catch (cause) {
      showFailure(cause instanceof Error ? cause.message : 'No se pudo generar el diseño.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <EditorDesignDialogFrame busy={busy} onClose={onClose}
      title={mode === 'proposal' ? 'Propuesta editable' : mode === 'renders' ? 'Previsualiza tus vistas' : 'Diseñar el espacio'}>
        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
        {mode === 'proposal' && proposal ? (
          <><p role="status" className="mt-4 rounded-lg border border-line bg-canvas p-3 text-sm">
            {applied ? 'Cambios aplicados al plano. Puedes verlos al cerrar y deshacerlos con ⌘Z / Ctrl+Z. Guarda el plano para sincronizarlos.'
              : 'Propuesta lista. El plano aún no ha cambiado: revisa los acabados y pulsa «Aplicar al plano».'}
          </p><fieldset disabled={applied || busy}><ProposalPreview proposal={proposal} selection={selection!} palette={materialPalette}
            onChange={setSelection} onMaterialChange={(key, value) => setProposal((current) => current
              ? { ...current, materials: { ...current.materials, [key]: value } } : current)}
            onRoomFinishChange={(roomId, key, value) => setProposal((current) => current
              ? { ...current, roomFinishes: current.roomFinishes?.map((finish) => finish.roomId === roomId ? { ...finish, [key]: value } : finish) }
              : current)} /></fieldset></>
        ) : (
          <>
            {onEvaluateQuality ? (
              <EditorQualityGate
                evaluate={onEvaluateQuality}
                onChange={(state) => { setQuality(state); if (state.quality?.decision === 'proceed') setServerConfirm(null); }}
                serverConfirmMessage={serverConfirm}
                renderPlanIssues={renderPlanIssues}
              />
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Qué quieres crear">
              {/* Primero se diseña el plano con IA (sin imágenes) y después se crean las imágenes de ese diseño. */}
              {([['editable', '1. Diseñar el plano', 'La IA coloca muebles, baños, cocina y acabados en el 2D y el 3D. No crea imágenes.', Sofa], ['image', '2. Crear imágenes', 'Render del plano ya diseñado, sin modificarlo.', Camera]] as const).map(([value, label, hint, Icon]) => (
                <button key={value} type="button" disabled={busy} aria-pressed={intent === value}
                  className={`rounded-lg border px-3 py-2 text-left ${intent === value ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700' : 'border-line bg-surface text-ink'}`}
                  onClick={() => {
                    if (value === intent) return;
                    optionsByIntent.current[intent] = options;
                    const next = optionsByIntent.current[value] ?? { ...options,
                      placement: 'all', regions: [], designScope: 'all', designZoneId: '',
                      // Diseñar el plano parte de «Amueblar»: la propuesta equipa la vivienda entera.
                      ...(value === 'editable' ? { freedom: 'free' as const, additions: [] } : {}) };
                    setOptions(value === 'image' && hasDesign && !optionsByIntent.current.image ? { ...next, ...DRESSED_IMAGE_OPTIONS } : next);
                    setIntent(value);
                    if (value === 'editable' && next.designScope !== 'all' && establishedStyle)
                      setEstilo(establishedStyle);
                    invalidatePrepared(); setMode('choose');
                  }}>
                  <strong className="flex items-center gap-2 text-sm"><Icon size={16} aria-hidden="true" className="shrink-0" />{label}</strong>
                  <span className="mt-0.5 block text-xs leading-tight">{hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <div>
                <p className="text-ink-soft text-sm">
                  {intent === 'image' ? '1. Configura el aspecto. 2. Revisa las vistas de referencia (sin IA). 3. Genera las imágenes con IA. El plano no cambia. Con las imágenes que aceptes podrás crear después los vídeos.' : 'La IA propondrá acabados y objetos permitidos del catálogo. No crea una imagen: revisa el resultado y pulsa Aplicar al plano. Consultar la IA puede consumir créditos; no garantiza que haya objetos que encajen.'}
                </p>
                {initialSetup?.continuation && batchId === initialSetup.continuation.batchId && <p role="status" className="mt-3 rounded-control border border-line bg-surface-soft p-3 text-sm">
                  Completar tanda: se conservan {initialSetup.continuation.completedViews.length} vistas guardadas. Preparar y generar solo procesa las {options.views.length} pendientes. Revisa las instrucciones antes de generar: el texto libre anterior no se recupera.
                </p>}
                {preferencesOwner && <RenderPresetControls disabled={busy} onInstructionLoad={(instruction) => { invalidatePrepared(); setPromptLibre(instruction); }}
                  current={{ style: estilo, objective: objetivo, instruction: promptLibre, intent, options, spaceKind }} onLoad={(preset) => {
                    invalidatePrepared();
                    setIntent(preset.intent); setOptions(preset.options);
                    setEstilo(preset.intent === 'editable' && preset.options.designScope !== 'all' && establishedStyle ? establishedStyle : preset.style);
                    setObjetivo(preset.objective); setPromptLibre(preset.instruction);
                    if (preset.spaceKind) onSpaceKindChange(preset.spaceKind);
                    optionsByIntent.current[preset.intent] = preset.options;
                  }} />}
                {intent === 'image' && !capture && !prepared.length && (
                  <p className="bg-canvas text-ink-soft mt-3 rounded-control border border-line p-3 text-xs">
                    Este flujo necesita preparar una captura 3D. Para conservar una cámara concreta,
                    vuelve al editor 3D y selecciona una vista antes de preparar.
                  </p>
                )}
                {intent === 'editable' && <DesignScopePicker document={document} options={options} onChange={changeOptions}
                  onCreateZone={onCreateDesignZone} onRenameZone={onRenameDesignZone}
                  onReshapeZone={onReshapeDesignZone} onRemoveZone={onRemoveDesignZone} disabled={busy} />}
                {intent === 'image' && !interiorMode && !zoneCompositeActive(options) &&
                  (options.views.some((view) => ['drone', 'isometric', 'exterior'].includes(view)) || prepared.some((item) => ['drone', 'isometric', 'exterior'].includes(item.view.preset))) &&
                  <DroneReferenceField savedSite={document?.geographicSite?.confirmed} value={orthophotoDataUrl} onChange={(value) => { setOrthophotoDataUrl(value); setResults([]); setBatchId(null); }} disabled={busy} />}
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
                              label: labelAt(index),
                              ...(item.maskDataUrl ? { maskSrc: item.maskDataUrl } : {}),
                            })
                          }
                          aria-label={`Abrir ${labelAt(index)} en grande`}
                        >
                          <ZoneOverlayImage
                            src={item.dataUrl}
                            maskSrc={item.maskDataUrl}
                            alt={`Preview ${labelAt(index)}`}
                            className="w-full object-contain"
                          />
                        </button>
                        <figcaption className="text-ink-soft flex items-center justify-between gap-2 p-2 text-xs">
                          <span>
                            {labelAt(index)}
                            {item.maskDataUrl && ' · solo la zona seleccionada'} · pulsa para
                            ampliar
                          </span>
                          <button type="button" className="text-primary shrink-0 underline"
                            onClick={() => downloadCapture(item, index)}>Descargar</button>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {prepared.length > 0 && (
                  <div className="text-ink-soft mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>Estas vistas son capturas del 3D editable: no consumen créditos y coinciden entre sí.</span>
                    {prepared.length > 1 && (
                      <CheckToggle className="w-full" checked={styleAnchor} disabled={busy} onChange={setStyleAnchor}
                        label="Usar la primera imagen generada como referencia de estilo en las siguientes. Experimental: puede arrastrar geometría de otra cámara y hacer que se descarte una vista." />
                    )}
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={downloadAll}>
                      Descargar {prepared.length > 1 ? `las ${prepared.length} vistas` : 'la vista'} (sin IA)
                    </Button>
                  </div>
                )}
                {intent === 'editable' && !prepared.length && <PlanPreview2d document={document} />}
                {intent === 'image' && (capture || onPreview) && !prepared.length && (
                  <RenderLivePreview capture={capture} lighting={options.lighting} view={options.views[0] ?? 'current'}
                    options={options} onPreview={onPreview}
                    onExpand={(src, label, maskSrc) => setLargePreview({ src, label, ...(maskSrc ? { maskSrc } : {}) })} />
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
                {(intent === 'image' || !spaceKind) && <label className="text-ink-soft flex flex-col gap-1 text-sm">
                  Tipo de espacio
                  <ModernSelect
                    compact
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
                </label>}
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
                  <label htmlFor="editor-design-style" className="mb-1 block">Estilo</label>
                  <ModernSelect compact id="editor-design-style" value={estilo}
                    onChange={(event) => { setEstilo(event.target.value as Estilo); invalidatePrepared(); }}
                    disabled={busy || (intent === 'editable' && options.designScope !== 'all' && Boolean(establishedStyle))}>
                    {ESTILOS.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
                  </ModernSelect>
                  {intent === 'editable' && options.designScope !== 'all' && establishedStyle && (
                    <p className="mt-1 text-xs">Las zonas mantienen el estilo ya aplicado al inmueble. Para cambiarlo, diseña la planta completa.</p>
                  )}
                </div>
                <div className="bg-canvas rounded-card border border-line p-3 text-xs">
                  <p className="text-ink font-medium">Permisos efectivos</p>
                  <p className="text-ink-soft mt-1">
                    {intent === 'image' && <>{options.lighting === 'daylight'
                      ? 'Día'
                      : options.lighting === 'afternoon' ? 'Tarde' : options.lighting === 'warm'
                        ? 'Atardecer'
                        : 'Noche'} · </>}
                    {intent === 'editable' ? 'Modo' : 'Libertad'}{' '}
                    {options.freedom === 'strict'
                      ? intent === 'editable' ? 'acabados, sin añadir objetos' : 'estricta, sin añadir objetos'
                      : options.freedom === 'controlled'
                        ? `${intent === 'editable' ? 'solo categorías' : 'controlada'} (${options.additions.length ? options.additions.map((addition) => RENDER_ADDITION_LABELS[addition]).join(', ') : 'sin categorías'})`
                        : intent === 'editable' ? 'amueblar: muebles, baños, cocina y decoración' : 'libre, solo decoración sin construcción'}{' '}
                    ·{' '}
                    {intent === 'editable' && <>Ámbito {options.designScope === 'house' ? 'solo la casa de esta planta' : options.designScope === 'all' ? 'toda esta planta' : options.designScope === 'interior' ? 'interior' : options.designScope === 'exterior' ? 'exterior' : options.designScope === 'zone' ? document?.designZones?.find((zone) => zone.id === options.designZoneId)?.name ?? 'zona sin elegir' : `${options.designRoomIds.length} estancia(s) y ${options.designStructureIds.length} pieza(s) exteriores`} · </>}
                    {options.freedom === 'strict' && intent === 'editable'
                      ? 'sin colocación de objetos'
                      : options.placement === 'selected'
                      ? `${options.regions.length} zona(s) permitida(s)${zoneCompositeActive(options) && intent === 'image' ? ', verificadas contra la captura 3D' : ''}`
                      : intent === 'editable' ? 'todo el ámbito' : options.designScope === 'house' ? 'solo la casa de esta planta' : 'toda la planta'}{' '}
                    · {options.redesignFixed ? intent === 'editable' ? 'acabados de fijos autorizados' : 'rediseño de fijos autorizado' : 'fijos conservados'}
                    {intent === 'image' && <> · {itemCount} {interiorMode ? 'estancia(s).' : 'vista(s).'}</>}
                  </p>
                  {intent === 'image' && cachedEstimate && itemCount > 0 && (
                    <RenderCostEstimate key={renderPassCount(options)} passes={renderPassCount(options)}
                      estimate={cachedEstimate} />
                  )}
                  <p className="text-ink-soft mt-2">{intent === 'image' ? 'Revisa las vistas de referencia antes de generar las imágenes.' : 'Los cambios no se aplican hasta que pulses Aplicar al plano. No se modifica la geometría.'}</p>
                </div>
              </div>
            </div>
            {referenceNotice && <p role="status" className="mt-4 text-sm">{referenceNotice}</p>}
            {mode === 'renders' && projectId && document && renderableCaptures.filter((capture, index, all) => {
              const preset = requiredReferencePreset(capture.view, options);
              return preset && all.findIndex(other => requiredReferencePreset(other.view, options) === preset) === index;
            }).map(capture => {
              const preset = requiredReferencePreset(capture.view, options)!;
              return <RenderReferenceLibrary key={`${preset}-${renderBatchSettingsKey(options)}`} projectId={projectId} zoneId={zoneId}
                document={document} view={capture.view} options={options} disabled={busy || qualityBlocked} selectedId={referenceIds[preset]}
                onAdopt={(next, id) => { changeOptions(next); setReferenceIds({ [preset]: id }); setMode('choose');
                  setReferenceNotice('Se han recuperado los ajustes de la referencia. Pulsa Ver vistas de referencia para preparar de nuevo las cámaras; la imagen elegida se conserva.'); }}
                onSelect={id => { setReferenceIds(previous => ({ ...previous, [preset]: id })); setError(null); }} />;
            })}
            {mode === 'renders' && <ExistingRenderReview captures={renderableCaptures} disabled={busy || qualityBlocked} labelAt={labelAt} onReview={reviewExisting} />}
            {mode === 'renders' && completedCount > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-ink text-sm font-medium">Diseños de esta tanda</h3>
                  <span className="text-muted-foreground text-xs">
                    {completedCount}/{renderableCaptures.length} completadas
                  </span>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {!projectId && results.map((result, index) => result && (
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
                            label: labelAt(index),
                          })
                        }
                        aria-label={`Abrir resultado ${labelAt(index)} en grande`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- Render con URL firmada; descarga directa sin optimización remota. */}
                        <img
                          src={result.assetUrl}
                          alt={`Render ${labelAt(index)}`}
                          className="aspect-video w-full object-contain"
                        />
                      </button>
                      <figcaption className="text-ink-soft p-2 text-xs">
                        {labelAt(index)}
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
                {projectId && <GeneratedRenderGallery results={results} captures={renderableCaptures} options={options} projectId={projectId} zoneId={zoneId} revision={document?.revision ?? 0} />}
              </div>
            )}
          </>
        )}
        {error && (
          <p className="text-destructive mt-4 whitespace-pre-line text-sm" role="alert">
            {error}
          </p>
        )}
        {mode !== 'proposal' && <p className="text-ink-soft mt-4 text-xs">
          {intent === 'image' ? 'El plano es una guía. Abre cada imagen aquí o en Diseños para revisarla y aceptarla antes de usarla en vídeos o visitas. Las imágenes por sí solas no forman una escena navegable; el paseo virtual continuo desde diseños sigue pendiente.' : 'El ámbito elegido limita los acabados y los objetos nuevos. Estricto cambia solo acabados; controlado y libre permiten decoración, nunca cambios de construcción. Las zonas dibujadas acotan además los objetos.'}
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
              {intent === 'editable' && <>
                {proposalBlockedReason && (
                  <p className="text-muted-foreground self-center text-xs">{proposalBlockedReason}</p>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy || Boolean(proposalBlockedReason)}
                  onClick={() => void generateProposal()}
                >
                  Proponer acabados y muebles con IA
                </Button>
              </>}
              {intent === 'image' && onPrepare && !preparedReady && (
                <>
                  {!sceneReady && !busy && (
                    <p className="text-muted-foreground self-center text-xs" role="status">
                      Cargando el 3D… la preparación empezará sola al terminar.
                    </p>
                  )}
                  {prepareBlockedReason && (
                    <p className="text-muted-foreground self-center text-xs">{prepareBlockedReason}</p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || Boolean(prepareBlockedReason)}
                    onClick={() => void prepare()}
                  >
                    {busy
                      ? sceneReady
                        ? 'Preparando…'
                        : 'Esperando al 3D…'
                      : 'Ver vistas de referencia'}
                  </Button>
                </>
              )}
              {intent === 'image' && preparedReady && (
                <>
                  {qualityBlocked && <p role="status" className="self-center text-xs text-amber-900">
                    {quality.blocked ? 'Corrige los problemas indicados arriba antes de generar.' : 'Marca arriba «He revisado el plano y quiero generar con estos avisos» para continuar.'}
                  </p>}
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
                    disabled={busy || qualityBlocked || completedCount >= renderableCaptures.length}
                    onClick={() => void renderBatch()}
                  >
                    {busy
                      ? `${Math.min(completedCount + 1, renderableCaptures.length)}/${renderableCaptures.length} renderizando…`
                      : completedCount
                        ? 'Reintentar pendientes'
                        : 'Generar imágenes con IA'}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
        {largePreview && <DesignPreviewDialog preview={largePreview} onClose={() => setLargePreview(null)} />}
    </EditorDesignDialogFrame>
  );
}

export default EditorGenerateDialog;
