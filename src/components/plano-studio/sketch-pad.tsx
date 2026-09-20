'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { UploadedImage } from '@/components/chat/image-upload';

type Stroke = number[];
const WIDTH = 900;
const HEIGHT = 600;

export function SketchPad({
  onUse,
  disabled,
}: {
  onUse: (image: UploadedImage) => void;
  disabled: boolean;
}) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke>([]);
  const [mode, setMode] = useState<'line' | 'free'>('line');
  const active = useRef<Stroke | null>(null);
  const [error, setError] = useState('');

  function point(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(WIDTH, ((event.clientX - rect.left) * WIDTH) / rect.width)),
      Math.max(0, Math.min(HEIGHT, ((event.clientY - rect.top) * HEIGHT) / rect.height)),
    ];
  }

  function finish() {
    const stroke = active.current;
    if (stroke && stroke.length >= 4) setStrokes((all) => [...all, stroke]);
    active.current = null;
    setCurrent([]);
  }

  function useDrawing() {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Tu navegador no permite exportar el dibujo.');
      return;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const stroke of strokes) {
      ctx.beginPath();
      ctx.moveTo(stroke[0]!, stroke[1]!);
      for (let i = 2; i < stroke.length; i += 2) ctx.lineTo(stroke[i]!, stroke[i + 1]!);
      ctx.stroke();
    }
    onUse({ base64: canvas.toDataURL('image/png').split(',')[1]!, mimeType: 'image/png' });
  }

  return (
    <section className="w-full space-y-3" aria-label="Dibujar un boceto">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={mode === 'line' ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => setMode('line')}
        >
          Muros rectos
        </Button>
        <Button
          size="sm"
          variant={mode === 'free' ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => setMode('free')}
        >
          Lápiz libre
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !strokes.length}
          onClick={() => setStrokes((all) => all.slice(0, -1))}
        >
          Deshacer trazo
        </Button>
      </div>
      <p className="text-ink-soft text-sm">
        Arrastra para dibujar. Deja huecos para puertas y ventanas; puedes añadir detalles con el
        lápiz.
      </p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        aria-label="Lienzo de boceto"
        role="img"
        className="border-line w-full touch-none select-none rounded-lg border bg-white"
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          active.current = point(event);
          setCurrent(active.current);
        }}
        onPointerMove={(event) => {
          if (!active.current || disabled) return;
          active.current =
            mode === 'line'
              ? [...active.current.slice(0, 2), ...point(event)]
              : [...active.current, ...point(event)];
          setCurrent(active.current);
        }}
        onPointerUp={finish}
        onPointerCancel={() => {
          active.current = null;
          setCurrent([]);
        }}
      >
        {[...strokes, current].map((stroke, index) => (
          <polyline
            key={index}
            points={stroke.join(' ')}
            fill="none"
            stroke="#111"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <Button disabled={disabled || !strokes.length} onClick={useDrawing}>
        Usar dibujo como plano
      </Button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
