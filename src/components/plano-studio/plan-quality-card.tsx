'use client';

/**
 * Indicador de fiabilidad del plano importado y puerta de envío al editor.
 *
 * El veredicto lo da Jev sobre la evidencia medible de la extracción y decide
 * el texto y el botón: seguir, confirmar dudas o ir a corregir al editor. Es la
 * misma información que la acción de servidor aplica, mostrada al usuario.
 */
import { Button } from '@/components/ui/button';
import { QualityVerdictCard } from '@/components/quality/quality-verdict-card';
import type { StudioQuality } from '@/lib/studio-state';

const BLOCKED_NOTE =
  'No se generarán diseños ni vistas con este plano hasta que lo corrijas en el editor.';

interface Props {
  quality?: StudioQuality | null;
  /** Confirmación en dos pasos ya aceptada. */
  confirmApply: boolean;
  busy: boolean;
  applying: boolean;
  onApply: () => void;
  onCancel: () => void;
}

export function PlanQualityCard({ quality, confirmApply, busy, applying, onApply, onCancel }: Props) {
  const decision = quality?.decision ?? 'proceed';
  const blocked = decision === 'block';

  return (
    <>
      {quality ? <QualityVerdictCard quality={quality} blockedNote={BLOCKED_NOTE} /> : null}

      <div className="border-line bg-surface rounded-card border p-3">
        <p className="text-ink-soft mb-2 text-xs">{message(decision, confirmApply)}</p>
        <Button
          type="button"
          size="sm"
          variant={confirmApply || blocked ? 'default' : 'outline'}
          className="w-full"
          onClick={onApply}
          disabled={busy}
        >
          {applying ? 'Enviando…' : buttonLabel(decision, confirmApply)}
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

function message(decision: StudioQuality['decision'], confirmApply: boolean): string {
  if (decision === 'block') {
    return 'La lectura no es fiable. Llevamos el plano al editor para que lo corrijas allí; reemplaza el plano actual del proyecto.';
  }
  if (confirmApply) return 'Esto REEMPLAZA el plano actual del editor de este proyecto. ¿Continuar?';
  if (decision === 'confirm') {
    return 'Hay dudas sobre la lectura (ver arriba). Revisa las medidas y confirma si quieres enviarlo al editor.';
  }
  return 'Envía muros, huecos, estancias y mobiliario al editor para seguir trabajando.';
}

function buttonLabel(decision: StudioQuality['decision'], confirmApply: boolean): string {
  if (decision === 'block') return 'Abrir en el editor para corregir';
  if (confirmApply) return 'Sí, reemplazar y abrir el editor';
  if (decision === 'confirm') return 'Entiendo las dudas, enviar al editor';
  return 'Enviar al editor';
}
