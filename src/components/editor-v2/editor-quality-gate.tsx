'use client';

/**
 * Puerta de calidad dentro del diálogo de generación del editor.
 *
 * Enseña el veredicto de Jev sobre el plano guardado antes de gastar: con dudas
 * pide una confirmación expresa (la misma que el servidor vuelve a exigir) y
 * con fiabilidad baja explica qué corregir. La decisión real la toma siempre el
 * servidor; esto solo evita que el usuario pague por enterarse.
 *
 * Si el servidor acaba pidiendo esa confirmación (`serverConfirmMessage`), la
 * casilla se enseña igualmente aunque la tarjeta dijera otra cosa: nunca se deja
 * al usuario en un callejón sin salida.
 */
import { useState } from 'react';
import { QualityVerdictCard } from '@/components/quality/quality-verdict-card';
import { useMountEffect } from '@/lib/use-mount-effect';
import type { QualityVerdict } from '@/lib/quality-verdict';
import { CheckToggle } from '@/components/ui/check-toggle';

const BLOCKED_NOTE =
  'No se generará ninguna imagen ni propuesta con este plano: corrígelo en el editor y vuelve a abrir este diálogo.';

const BLOCKED_HELP = [
  'Cierra las estancias: cada recinto debe quedar rodeado por muros unidos.',
  'Une los muros en vértices compartidos y borra los muros de longitud casi nula.',
  'Coloca puertas y ventanas sobre un muro existente, sin que sobresalgan.',
  'Define la escala del plano para que las medidas sean físicas.',
];

export interface EditorQualityState {
  quality: QualityVerdict | null;
  ack: boolean;
  /** `true` cuando el servidor no dejaría generar con el estado actual. */
  blocked: boolean;
}

interface Props {
  evaluate: () => Promise<QualityVerdict | null>;
  onChange: (state: EditorQualityState) => void;
  /** Mensaje del servidor cuando ha cortado por falta de confirmación expresa. */
  serverConfirmMessage?: string | null;
}

export function EditorQualityGate({ evaluate, onChange, serverConfirmMessage = null }: Props) {
  const [quality, setQuality] = useState<QualityVerdict | null>(null);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useMountEffect(() => {
    let active = true;
    evaluate()
      .then((verdict) => {
        if (!active) return;
        setQuality(verdict);
        onChange({ quality: verdict, ack: false, blocked: verdict?.decision === 'block' });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        // No se bloquea por no poder consultar: el servidor vuelve a evaluar al generar.
        setError(cause instanceof Error ? cause.message : 'No se pudo comprobar la calidad del plano.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  });

  const toggleAck = (value: boolean) => {
    setAck(value);
    onChange({ quality, ack: value, blocked: quality?.decision === 'block' });
  };

  // El servidor manda: si ha cortado pidiendo confirmación, hay que enseñar la
  // casilla aunque la evaluación del diálogo no llegara o dijera otra cosa.
  const shown: QualityVerdict | null = serverConfirmMessage
    ? {
        score: quality?.score ?? null,
        decision: 'confirm',
        reasons: quality?.reasons.length ? quality.reasons : [serverConfirmMessage],
        failOpen: quality?.failOpen ?? false,
      }
    : quality;

  if (loading && !serverConfirmMessage) {
    return <p className="text-ink-soft mt-4 text-xs">Comprobando la calidad del plano…</p>;
  }
  if (error && !serverConfirmMessage) {
    return (
      <p className="text-ink-soft mt-4 text-xs" role="status">
        {error}
      </p>
    );
  }
  if (!shown) return null;

  return (
    <div className="mt-4 space-y-2">
      <QualityVerdictCard quality={shown} blockedNote={BLOCKED_NOTE} />
      {shown.decision === 'block' ? (
        <div className="bg-canvas rounded-card border border-line p-3 text-xs">
          <p className="text-ink font-medium">Cómo corregir el plano</p>
          <ul className="text-ink-soft mt-1 list-disc space-y-0.5 pl-4">
            {BLOCKED_HELP.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {shown.decision === 'confirm' ? (
        <CheckToggle checked={ack} onChange={toggleAck} label="Entiendo las dudas y quiero generar igualmente" />
      ) : null}
    </div>
  );
}

export default EditorQualityGate;
