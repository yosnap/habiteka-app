'use client';

/**
 * Propuesta de Jev cuando no da por buena la lectura del plano: redibujarlo con
 * IA como plano técnico limpio y volver a leerlo. Generar tiene coste y se
 * autoriza aquí; volver a leer una imagen ya generada solo repite el análisis.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface RedrawQuote {
  provider: string;
  model: string;
  label: string;
  priceUsd: number;
}

export interface RedrawComparison {
  sourceUrl: string;
  redrawUrl: string;
  reading: 'source' | 'tecnico';
}

interface Props {
  /** Jev da por buena la lectura actual: no se propone gasto. */
  approved: boolean;
  quote: RedrawQuote | null;
  quoteError: string | null;
  comparison: RedrawComparison | null;
  busy: boolean;
  redrawing: boolean;
  onRedraw: (quote: RedrawQuote) => void;
  onReread: (image: 'source' | 'tecnico') => void;
}

export function PlanRedrawOffer({
  approved,
  quote,
  quoteError,
  comparison,
  busy,
  redrawing,
  onRedraw,
  onReread,
}: Props) {
  const [authorized, setAuthorized] = useState(false);
  if (approved && !comparison) return null;

  return (
    <div className="border-line bg-surface rounded-card flex flex-col gap-3 border p-3 text-sm">
      {comparison ? (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['source', comparison.sourceUrl, 'Tu imagen original'],
              ['tecnico', comparison.redrawUrl, 'Redibujado técnico'],
            ] as const
          ).map(([image, url, label]) => (
            <figure key={image} className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={label}
                className={`rounded-control border bg-white object-contain ${
                  comparison.reading === image ? 'border-brand-500 border-2' : 'border-line'
                }`}
                style={{ aspectRatio: '4 / 3' }}
              />
              <figcaption className="text-ink-soft flex items-center justify-between gap-2 text-xs">
                <span>
                  {label}
                  {comparison.reading === image ? ' · lectura actual' : ''}
                </span>
                {comparison.reading !== image ? (
                  <button
                    type="button"
                    className="underline"
                    disabled={busy}
                    onClick={() => onReread(image)}
                  >
                    Leer esta · sin generar
                  </button>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {approved ? null : (
        <>
          <p>
            {comparison
              ? 'Jev tampoco da por buena esta lectura. Puedes generar otro redibujado o corregir el plano en el editor.'
              : 'Jev no da por buena la lectura de esta imagen: pasarla al editor así daría muros y huecos poco fiables. Te propongo redibujarla como un plano técnico limpio y volver a leerla. Jev revisará la nueva lectura.'}
          </p>
          {quoteError ? (
            <p role="alert" className="text-xs text-red-700">
              {quoteError}
            </p>
          ) : quote ? (
            <>
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={authorized}
                  disabled={busy}
                  onChange={(event) => setAuthorized(event.target.checked)}
                />
                <span>
                  Autorizo 1 imagen ({quote.priceUsd.toFixed(2).replace(".", ",")} USD) con {quote.label} y su lectura
                  con IA, que se factura aparte.
                </span>
              </label>
              <Button
                type="button"
                size="sm"
                className="self-start"
                disabled={!authorized || busy}
                onClick={() => {
                  setAuthorized(false);
                  onRedraw(quote);
                }}
              >
                {redrawing
                  ? 'Redibujando y leyendo…'
                  : comparison
                    ? 'Generar otro redibujado'
                    : 'Redibujar con IA y volver a leer'}
              </Button>
            </>
          ) : (
            <p className="text-ink-soft text-xs">Calculando el precio del redibujado…</p>
          )}
        </>
      )}
    </div>
  );
}
