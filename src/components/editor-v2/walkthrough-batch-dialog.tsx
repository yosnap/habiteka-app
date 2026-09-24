'use client';

import { useRef, useState } from 'react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { CaptureRenderView, RenderCapture } from '@/lib/editor-document/render-view';
import { cameraPoseFromView } from '@/lib/contracts/walkthrough-keyframe';
import { sameCameraPose } from '@/lib/contracts/storyboard-image';
import { defaultRenderDesignOptions, type RenderGeneratedResult } from '@/lib/editor-document/render-design-options';
import { walkthroughKeyframes } from '@/lib/editor-document/walkthrough-keyframes';
import { setStoryboardImage } from '@/lib/editor-document/walkthrough-storyboard';
import type { EditorShellProps } from './editor-shell';
import { StyleGallery } from '@/components/canvas/style-gallery';
import type { Estilo } from '@/lib/contracts';
import { runRenderBatch } from './render-batch';
import { storyboardBatchPoints } from '@/lib/editor-document/storyboard-batch';
import { ModernSelect } from '@/components/ui/modern-select';

interface Frame { waypointId: string; label: string; capture: RenderCapture }

/**
 * Lote de vistas de un recorrido.
 *
 * PENDIENTE DE MONTAJE: hoy ningún componente renderiza este diálogo. Cuando se
 * monte, `qualityAck` NO puede quedarse en su valor por defecto (`false`): debe
 * venir de un `EditorQualityGate` montado en este mismo diálogo, con el mismo
 * documento que evaluará la puerta del servidor. Si no, un plano en banda
 * «confirmar» hará fallar todas las imágenes del lote una a una, sin que el
 * usuario tenga dónde confirmar. El corte real lo sigue haciendo el servidor:
 * dejarlo en `false` es seguro (nunca genera de más), pero no es usable.
 */
export function WalkthroughBatchDialog({ store, getCapture, render, estimate, qualityAck = false, onResult, onClose }: {
  store: EditorStore;
  getCapture: () => Promise<CaptureRenderView>;
  render: NonNullable<EditorShellProps['onGenerateRender']>;
  estimate: NonNullable<EditorShellProps['onEstimateRender']>;
  /** Confirmación de la puerta de calidad cuando el veredicto de Jev pide confirmar. */
  qualityAck?: boolean;
  onResult: () => void;
  onClose: () => void;
}) {
  const [estilo, setEstilo] = useState<Estilo>('moderno');
  const [lighting, setLighting] = useState<'daylight' | 'warm' | 'evening'>('daylight');
  const [instructions, setInstructions] = useState('');
  const [frames, setFrames] = useState<Frame[]>([]);
  const [results, setResults] = useState<Array<RenderGeneratedResult | undefined>>([]);
  const [price, setPrice] = useState<{ estimatedUsd: number; model: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const stop = useRef(false), snapshot = useRef(''), routeId = useRef(''), batchId = useRef('');
  const fingerprint = () => JSON.stringify({ ...store.getState().document, revision: 0 });
  const reset = () => { setFrames([]); setResults([]); setPrice(null); setError(''); setStatus(''); };
  const prepare = async () => {
    if (busy) return;
    setBusy(true); reset();
    try {
      const state = store.getState();
      if (state.readOnly) throw new Error('La sesión no permite generar.');
      const route = state.document.walkthroughs?.find((item) => item.id === state.walkthroughId);
      if (!route) throw new Error('Selecciona un recorrido.');
      const selected = storyboardBatchPoints(route);
      routeId.current = route.id; snapshot.current = fingerprint(); batchId.current = crypto.randomUUID();
      const poses = walkthroughKeyframes(state.document, route);
      const quote = await estimate(selected.length);
      const capture = await getCapture();
      const prepared: Frame[] = [];
      for (const [index, id] of selected.entries()) {
        setStatus(`Preparando captura ${index + 1} de ${selected.length}…`);
        const pose = poses.find((item) => item.waypointId === id)!;
        const image = await capture({ camera: pose.camera, lighting });
        if (snapshot.current !== fingerprint()) throw new Error('El plano cambió. Prepara de nuevo las vistas.');
        if (!sameCameraPose(cameraPoseFromView(image.view), pose.camera)) throw new Error('La captura no coincide con el punto. Vuelve a prepararla.');
        prepared.push({ waypointId: id, label: `Punto ${route.waypoints.findIndex((item) => item.id === id) + 1}`, capture: image });
      }
      setPrice(quote); setFrames(prepared); setStatus('Capturas listas. Revisa los encuadres antes de generar.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron preparar las vistas.'); }
    finally { setBusy(false); }
  };
  const generate = async () => {
    if (busy || !frames.length || !price) return;
    setBusy(true); setStopping(false); setError(''); stop.current = false;
    const options = { ...defaultRenderDesignOptions(), lighting };
    try {
      const outcome = await runRenderBatch({ items: frames, initialResults: results, shouldStop: () => stop.current,
        render: async (frame, index, referenceDesignId) => {
          if (store.getState().readOnly || snapshot.current !== fingerprint()) throw new Error('El plano cambió. Conservamos las imágenes terminadas en Diseños; prepara de nuevo las pendientes.');
          setStatus(`Generando ${index + 1} de ${frames.length}…`);
          const result = await render({ estilo, objetivo: '', promptLibre: instructions, options,
            capture: frame.capture, batchId: batchId.current, qualityAck, ...(referenceDesignId ? { referenceDesignId } : {}) });
          // Una asociación fallida nunca debe hacer repetir una generación que ya terminó.
          if (result.id && !store.getState().readOnly && snapshot.current === fingerprint()) {
            try {
              const state = store.getState();
              state.apply(setStoryboardImage(state.document, routeId.current, { waypointId: frame.waypointId,
                deliverableId: result.id, camera: cameraPoseFromView(frame.capture.view) }));
              snapshot.current = fingerprint();
            } catch { setError('Una imagen se guardó en Diseños, pero no pudo asociarse a su punto.'); }
          } else {
            setError('El plano cambió. El resultado sigue disponible en Diseños.'); stop.current = true;
          }
          return result;
        },
        onResult: (_result, _index, saved) => { setResults(saved); onResult(); },
      });
      setResults(outcome.results);
      if (outcome.error) setError(outcome.error instanceof Error ? outcome.error.message : 'No se pudo completar el lote.');
      setStatus(outcome.stopped ? 'Lote detenido. Las imágenes terminadas se conservan.' : `${outcome.results.filter(Boolean).length} de ${frames.length} imágenes terminadas.`);
    } finally { setBusy(false); setStopping(false); }
  };
  const completed = results.filter(Boolean).length;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <section role="dialog" aria-modal="true" aria-label="Generar vistas del recorrido" className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5 text-slate-900">
      <header className="flex items-center justify-between"><h2>Generar vistas del recorrido</h2><button type="button" disabled={busy} onClick={onClose}>Cerrar</button></header>
      <p>Hasta 8 vistas por lote. Primero revisa las capturas sin IA. Cada imagen terminada queda guardada en Diseños.</p>
      <fieldset disabled={busy}>
        <StyleGallery value={estilo} onChange={(value) => { setEstilo(value); reset(); }} />
        <label>Iluminación<ModernSelect value={lighting} onChange={(event) => { setLighting(event.target.value as typeof lighting); reset(); }}>
          <option value="daylight">Día</option><option value="warm">Atardecer</option><option value="evening">Noche</option>
        </ModernSelect></label>
        <label>Instrucciones<input value={instructions} maxLength={500} onChange={(event) => { setInstructions(event.target.value); reset(); }} /></label>
        <button type="button" onClick={() => void prepare()}>Preparar vistas sin IA</button>
      </fieldset>
      {status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}
      {!!frames.length && <div className="grid grid-cols-2 gap-3">
        {frames.map((frame, index) => <figure key={frame.waypointId}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={results[index]?.assetUrl ?? frame.capture.dataUrl} alt={`${frame.label}: ${results[index] ? 'imagen generada' : 'captura de referencia'}`} className="aspect-video w-full object-contain" />
          <figcaption>{frame.label} · {results[index] ? 'Guardada' : 'Pendiente'}</figcaption>
        </figure>)}
      </div>}
      {price && <p>Coste estimado del modelo para este lote: {price.estimatedUsd.toFixed(4)} USD. Es una estimación; puede variar si se utiliza un modelo de respaldo.</p>}
      <footer className="mt-4 flex gap-3">
        <button type="button" disabled={busy || !price || !frames.length || completed === frames.length} onClick={() => void generate()}>
          {completed ? `Continuar ${frames.length - completed} pendientes` : 'Generar imágenes con IA'}
        </button>
        {busy && <button type="button" disabled={stopping} onClick={() => { stop.current = true; setStopping(true); }}>Detener después de la imagen actual</button>}
      </footer>
    </section>
  </div>;
}
