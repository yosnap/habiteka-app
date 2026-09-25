'use client';

/**
 * Indicador de fiabilidad del plano importado y puerta de envío al editor.
 *
 * El veredicto lo da Jev sobre la evidencia medible de la extracción. Se muestra
 * antes de confirmar el envío al editor, también si la lectura está bloqueada.
 */
import { Button } from '@/components/ui/button';
import { QualityVerdictCard } from '@/components/quality/quality-verdict-card';
import type { StudioQuality } from '@/lib/studio-state';

const BLOCKED_NOTE =
  'No se generarán diseños ni vistas con este plano hasta que lo corrijas en el editor.';

interface Props {
  quality?: StudioQuality | null;
  summary: {
    /** null cuando esta ruta aún no conoce si el editor contiene un plano. */
    replacesExisting: boolean | null;
    rooms: number;
    exteriors: number;
    furniture: number;
  };
  /** Hay cambios en las medidas o el mobiliario que aún no están en la geometría. */
  needsRefit?: boolean;
  /** Confirmación en dos pasos ya aceptada. */
  confirmApply: boolean;
  busy: boolean;
  applying: boolean;
  onApply: () => void;
  onCancel: () => void;
}

export function PlanQualityCard({ quality, summary, needsRefit = false, confirmApply, busy, applying, onApply, onCancel }: Props) {
  const decision = quality?.decision ?? 'proceed';
  const contents = `${countLabel(summary.rooms, 'estancia', 'estancias')}, ${countLabel(summary.exteriors, 'zona exterior', 'zonas exteriores')} y ${countLabel(summary.furniture, 'mueble', 'muebles')}`;

  return (
    <>
      {quality ? <QualityVerdictCard quality={quality} blockedNote={BLOCKED_NOTE} /> : null}

      <div className="border-line bg-surface rounded-card border p-3">
        <p className="text-ink-soft mb-2 text-xs">{message(decision, confirmApply, summary.replacesExisting)}</p>
        {confirmApply ? (
          <p className="text-ink mb-2 text-xs">Nuevo plano: {contents}.</p>
        ) : null}
        {needsRefit ? (
          <p className="mb-2 text-xs text-amber-800" role="status">Recalcula el plano revisado antes de enviarlo al editor.</p>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant={confirmApply ? 'default' : 'outline'}
          className="w-full"
          onClick={onApply}
          disabled={busy || needsRefit}
        >
          {applying ? 'Enviando…' : buttonLabel(confirmApply, summary.replacesExisting)}
        </Button>
        {confirmApply ? (
          <Button type="button" size="sm" variant="ghost" className="mt-1 w-full" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </>
  );
}

function message(decision: StudioQuality['decision'], confirmApply: boolean, replacesExisting: boolean | null): string {
  if (confirmApply) {
    const destination = replacesExisting === true
      ? 'Este envío reemplazará el plano actual del editor.'
      : replacesExisting === false
        ? 'Este envío creará un plano editable en el proyecto.'
        : 'Este envío actualizará el editor y reemplazará su plano actual si ya existe.';
    return decision === 'block'
      ? `${destination} La lectura no es fiable: tendrás que corregirla en el editor antes de generar diseños o vistas. ¿Continuar?`
      : `${destination} ¿Continuar?`;
  }
  if (decision === 'block') {
    return 'La lectura no es fiable. Revisa el contenido y el destino antes de llevarlo al editor para corregirlo.';
  }
  if (decision === 'confirm') {
    return 'Hay dudas sobre la lectura (ver arriba). Revisa las medidas antes de enviarlo al editor.';
  }
  return 'Revisa el contenido antes de enviar el plano al editor.';
}

function buttonLabel(confirmApply: boolean, replacesExisting: boolean | null): string {
  if (!confirmApply) return 'Revisar envío al editor';
  if (replacesExisting === null) return 'Sí, enviar y abrir el editor';
  return replacesExisting ? 'Sí, reemplazar y abrir el editor' : 'Sí, crear y abrir el editor';
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
