'use client';

/**
 * Acciones de un diseño en «Diseños»: descargarlo, pedir un cambio con texto (crea
 * una versión nueva y conserva la anterior) o preparar una variante en el asistente.
 * El plano se descarga desde su propio visor (el PNG sale del lienzo con el sello).
 */
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { callAction } from '@/lib/action-result';
import {
  evaluateChangeInstruction,
  requestDeliverableChange,
  startDesignVariant,
} from '@/app/(app)/projects/[id]/_actions/deliverable-actions';
import { QualityVerdictCard } from '@/components/quality/quality-verdict-card';
import type { QualityVerdict } from '@/lib/quality-verdict';
import type { DeliverableView } from './deliverables-panel';
import { drawableZones } from './plan2d-to-konva';
import { CheckToggle } from '@/components/ui/check-toggle';
import { ModernSelect } from '@/components/ui/modern-select';
import type { CanvasZone } from '@/lib/contracts';

export interface ImageChangeEditor {
  scope: 'region' | 'whole'; zone: CanvasZone | null;
  onScopeChange: (scope: 'region' | 'whole') => void;
  onClear: () => void; onOpenChange: (open: boolean) => void; onPendingChange: (pending: boolean) => void;
}

const CHANGE_HINT: Record<DeliverableView['type'], string> = {
  render3d: 'Ej.: «suelo de madera clara», «más luz natural», «sofá en tonos azules».',
  plano2d: 'Ej.: «añade una ventana en la pared norte», «ensancha la puerta».',
  memoria: 'Ej.: «presupuesto más ajustado», «sustituye el microcemento por baldosa».',
};

export function DeliverableActions({
  projectId,
  deliverable,
  highlightChanges = false,
  leadingAction,
  imageEditor,
}: {
  projectId: string;
  deliverable: DeliverableView;
  /** Resalta «Pedir cambios» cuando la calidad del resultado es baja. */
  highlightChanges?: boolean;
  leadingAction?: ReactNode;
  imageEditor?: ImageChangeEditor;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  // Solo estancias que el visor dibuja: no se ofrece cambiar una zona invisible.
  const planZones = deliverable.payload.type === 'plano2d' ? drawableZones(deliverable.payload.plano) : [];
  const [planZoneId, setPlanZoneId] = useState(planZones[0]?.id ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [evaluation, setEvaluation] = useState<{ signature: string; verdict: QualityVerdict } | null>(null);
  const [ack, setAck] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formContainer, setFormContainer] = useState<HTMLFormElement | null>(null);
  const imageZone: CanvasZone | undefined = imageEditor?.scope === 'region' ? imageEditor.zone ?? undefined
    : { id: 'global', bbox: { x: 0, y: 0, width: 1, height: 1 } };
  const signature = JSON.stringify({ instruction, imageZone });
  const verdict = evaluation?.signature === signature ? evaluation.verdict : null;
  const acknowledged = !!verdict && ack;
  const missingRegion = imageEditor?.scope === 'region' && !imageZone;
  const changeOpen = (value: boolean) => { setOpen(value); imageEditor?.onOpenChange(value); };

  // Cambiar el texto invalida el veredicto: la instrucción a juzgar es otra.
  const changeInstruction = (value: string) => {
    setInstruction(value);
    setEvaluation(null);
    setAck(false);
  };

  // La instrucción se juzga ANTES de gastar: con fiabilidad baja no se llama a la
  // IA y se pide reformular; con dudas hace falta confirmar expresamente. El
  // servidor vuelve a evaluar al aplicar (con caché), así que esto no decide nada.
  const submitChange = () =>
    startTransition(async () => {
      setMessage(null);
      if (missingRegion) { setMessage({ ok: false, text: 'Selecciona en la imagen la zona que quieres retocar.' }); return; }
      imageEditor?.onPendingChange(true);
      try {
        const quality = await callAction(
          evaluateChangeInstruction(projectId, deliverable.id, instruction, imageZone),
        );
        setEvaluation({ signature, verdict: quality });
        if (!verdict) setAck(false);
        if (quality.decision === 'block') return;
        if (quality.decision === 'confirm' && !acknowledged) return;
        const out = await callAction(
          requestDeliverableChange(
            projectId,
            deliverable.id,
            instruction,
            deliverable.payload.type === 'plano2d' ? planZoneId : undefined,
            quality.decision === 'confirm',
            imageZone,
          ),
        );
        setInstruction('');
        setEvaluation(null);
        setAck(false);
        changeOpen(false);
        setMessage({ ok: true, text: `Versión ${out.version} creada. Comprueba si aplica el cambio que pediste antes de aceptarla. La anterior se conserva.` });
        router.refresh();
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudo aplicar el cambio.' });
      } finally {
        imageEditor?.onPendingChange(false);
      }
    });

  const startVariant = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        await callAction(startDesignVariant(projectId, deliverable.zoneId));
        router.push(`/projects/${projectId}/chat${deliverable.zoneId ? `?zona=${deliverable.zoneId}` : ''}`);
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudo preparar la variante.' });
      }
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {leadingAction}
        <DownloadButton deliverable={deliverable} />
        <Button
          type="button"
          size="sm"
          variant={open || highlightChanges ? 'default' : 'outline'}
          aria-expanded={open}
          onClick={() => changeOpen(!open)}
          disabled={pending}
        >
          Pedir cambios
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={startVariant} disabled={pending}>
          Generar variante
        </Button>
      </div>

      {open ? (
        <form
          ref={setFormContainer}
          className="border-line bg-surface-muted flex flex-col gap-2 rounded-control border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitChange();
          }}
        >
          {imageEditor && <div className="flex flex-col gap-2 border-b border-line pb-3 mb-1">
            <label htmlFor={`scope-${deliverable.id}`} className="text-sm font-medium">Alcance del cambio</label>
            <ModernSelect id={`scope-${deliverable.id}`} value={imageEditor.scope} disabled={pending} popoverZIndex={170} portalContainer={formContainer}
              onChange={event => imageEditor.onScopeChange(event.target.value as 'region' | 'whole')}>
              <option value="region">Una zona de esta imagen</option>
              <option value="whole">Toda la imagen</option>
            </ModernSelect>
            {imageEditor.scope === 'region' ? <>
              <p id="image-region-help" className="text-xs text-ink-soft">Arrastra sobre la imagen para delimitar el cambio. Incluye el objeto y su sombra; deja fuera los muros que quieras conservar. Con teclado: enfoca la imagen, pulsa Intro, mueve con flechas y ajusta el tamaño con Mayús + flechas.</p>
              <p role="status" className="text-xs font-medium">{imageZone ? 'Zona seleccionada. El resto de la imagen se conservará.' : 'Falta seleccionar la zona.'}</p>
              {imageZone && <Button type="button" size="sm" variant="outline" onClick={imageEditor.onClear} disabled={pending}>Borrar selección</Button>}
              <p className="text-xs text-ink-soft">Revisa el resultado dentro de la zona y sus bordes antes de aceptarlo.</p>
            </> : <p className="text-xs text-ink-soft">La IA podrá modificar toda la imagen. Usa este alcance para cambios generales de estilo o iluminación y revisa de nuevo la distribución.</p>}
          </div>}
          <label className="text-ink text-sm font-medium" htmlFor={`change-${deliverable.id}`}>
            ¿Qué quieres cambiar?
          </label>
          {planZones.length > 1 ? (
            <ModernSelect
              portalContainer={formContainer}
              aria-label="Estancia a modificar"
              className="border-line rounded-control border bg-white p-1 text-sm"
              value={planZoneId}
              onChange={(e) => setPlanZoneId(e.target.value)}
            >
              {planZones.map((z) => (
                <option key={z.id} value={z.id}>{z.name || z.id}</option>
              ))}
            </ModernSelect>
          ) : null}
          <textarea
            id={`change-${deliverable.id}`}
            className="border-line rounded-control min-h-20 border bg-white p-2 text-sm"
            maxLength={500}
            disabled={pending}
            value={instruction}
            onChange={(e) => changeInstruction(e.target.value)}
            placeholder={imageEditor?.scope === 'region' ? 'Ej.: «quita la hoja del paso al comedor sin cambiar sus muros».' : CHANGE_HINT[deliverable.type]}
          />
          {verdict ? (
            <QualityVerdictCard
              quality={verdict}
              blockedNote="No se ha gastado nada: reformula la instrucción y vuelve a intentarlo."
            />
          ) : null}
          {verdict?.decision === 'confirm' ? (
            <CheckToggle checked={acknowledged} onChange={setAck} disabled={pending} label="Entiendo las dudas y quiero aplicar el cambio igualmente" />
          ) : null}
          <p className="text-ink-soft text-xs">
            Se crea una versión nueva con el cambio; la actual no se pierde. Los primeros
            cambios de cada diseño son gratis; después consumen créditos.
          </p>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={
                pending ||
                missingRegion ||
                instruction.trim().length < 3 ||
                verdict?.decision === 'block' ||
                (verdict?.decision === 'confirm' && !acknowledged)
              }
            >
              {pending ? 'Aplicando…' : 'Aplicar cambio'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => changeOpen(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p role="status" className={`text-sm ${message.ok ? 'text-emerald-800' : 'text-red-700'}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

/** Descarga directa del render o de la memoria; el plano se descarga desde su visor. */
function DownloadButton({ deliverable }: { deliverable: DeliverableView }) {
  const payload = deliverable.payload;
  if (payload.type === 'render3d') {
    return (
      <Button asChild size="sm" variant="outline">
        <a href={payload.assetUrl} download="habiteka-render.png" target="_blank" rel="noopener noreferrer">
          Descargar imagen
        </a>
      </Button>
    );
  }
  if (payload.type === 'memoria') {
    const download = () => {
      const url = URL.createObjectURL(new Blob([payload.markdown], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'habiteka-memoria-materiales.md';
      link.click();
      URL.revokeObjectURL(url);
    };
    return (
      <Button type="button" size="sm" variant="outline" onClick={download}>
        Descargar memoria
      </Button>
    );
  }
  return null;
}
