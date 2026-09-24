'use client';

/**
 * Acciones de un diseño en «Diseños»: descargarlo, pedir un cambio con texto (crea
 * una versión nueva y conserva la anterior) o preparar una variante en el asistente.
 * El plano se descarga desde su propio visor (el PNG sale del lienzo con el sello).
 */
import { useState, useTransition } from 'react';
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

const CHANGE_HINT: Record<DeliverableView['type'], string> = {
  render3d: 'Ej.: «suelo de madera clara», «más luz natural», «sofá en tonos azules».',
  plano2d: 'Ej.: «añade una ventana en la pared norte», «ensancha la puerta».',
  memoria: 'Ej.: «presupuesto más ajustado», «sustituye el microcemento por baldosa».',
};

export function DeliverableActions({
  projectId,
  deliverable,
  highlightChanges = false,
}: {
  projectId: string;
  deliverable: DeliverableView;
  /** Resalta «Pedir cambios» cuando la calidad del resultado es baja. */
  highlightChanges?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  // Solo estancias que el visor dibuja: no se ofrece cambiar una zona invisible.
  const planZones = deliverable.payload.type === 'plano2d' ? drawableZones(deliverable.payload.plano) : [];
  const [planZoneId, setPlanZoneId] = useState(planZones[0]?.id ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [verdict, setVerdict] = useState<QualityVerdict | null>(null);
  const [ack, setAck] = useState(false);
  const [pending, startTransition] = useTransition();

  // Cambiar el texto invalida el veredicto: la instrucción a juzgar es otra.
  const changeInstruction = (value: string) => {
    setInstruction(value);
    setVerdict(null);
    setAck(false);
  };

  // La instrucción se juzga ANTES de gastar: con fiabilidad baja no se llama a la
  // IA y se pide reformular; con dudas hace falta confirmar expresamente. El
  // servidor vuelve a evaluar al aplicar (con caché), así que esto no decide nada.
  const submitChange = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        const quality = await callAction(
          evaluateChangeInstruction(projectId, deliverable.id, instruction),
        );
        setVerdict(quality);
        if (quality.decision === 'block') return;
        if (quality.decision === 'confirm' && !ack) return;
        const out = await callAction(
          requestDeliverableChange(
            projectId,
            deliverable.id,
            instruction,
            deliverable.payload.type === 'plano2d' ? planZoneId : undefined,
            quality.decision === 'confirm',
          ),
        );
        setInstruction('');
        setVerdict(null);
        setAck(false);
        setOpen(false);
        setMessage({ ok: true, text: `Listo: versión ${out.version} creada arriba. La anterior se conserva.` });
        router.refresh();
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudo aplicar el cambio.' });
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
        <DownloadButton deliverable={deliverable} />
        <Button
          type="button"
          size="sm"
          variant={open || highlightChanges ? 'default' : 'outline'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
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
          className="border-line bg-surface-muted flex flex-col gap-2 rounded-control border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitChange();
          }}
        >
          <label className="text-ink text-sm font-medium" htmlFor={`change-${deliverable.id}`}>
            ¿Qué quieres cambiar?
          </label>
          {planZones.length > 1 ? (
            <ModernSelect
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
            value={instruction}
            onChange={(e) => changeInstruction(e.target.value)}
            placeholder={CHANGE_HINT[deliverable.type]}
          />
          {verdict ? (
            <QualityVerdictCard
              quality={verdict}
              blockedNote="No se ha gastado nada: reformula la instrucción y vuelve a intentarlo."
            />
          ) : null}
          {verdict?.decision === 'confirm' ? (
            <CheckToggle checked={ack} onChange={setAck} label="Entiendo las dudas y quiero aplicar el cambio igualmente" />
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
                instruction.trim().length < 3 ||
                verdict?.decision === 'block' ||
                (verdict?.decision === 'confirm' && !ack)
              }
            >
              {pending ? 'Aplicando…' : 'Aplicar cambio'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
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
