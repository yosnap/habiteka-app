'use client';

/**
 * Paso 0 del asistente: qué quiere hacer el usuario.
 *
 * Es la bifurcación de todo lo que viene después, así que se explica con
 * palabras llanas qué hace cada ruta y qué se obtiene al final. La elección se
 * guarda en el servidor (`set-intent`) para retomarla al recargar.
 */
import type { AssistantIntent } from '@/lib/contracts';
import { ArrowRight, ScanLine } from 'lucide-react';
import { CatalogNavigationImage } from '@/components/editor-v2/catalog-navigation-image';

interface Props {
  /** Ruta ya elegida (al volver a cambiarla), para marcarla como seleccionada. */
  intent?: AssistantIntent;
  pending: boolean;
  onPick: (intent: AssistantIntent) => void;
}

const OPTIONS: ReadonlyArray<{
  intent: AssistantIntent;
  title: string;
  summary: string;
  bullets: readonly string[];
}> = [
  {
    intent: 'design',
    title: 'Rediseñar una habitación con una foto (sin plano)',
    summary:
      'Súbeme una foto de la habitación tal y como está y te propongo cómo puede quedar con el estilo que elijas. No crea un plano.',
    bullets: [
      'Miro la foto y te digo qué he reconocido para que lo corrijas si hace falta.',
      'Eliges estilo y qué quieres recibir (imagen del ambiente, plano, memoria de materiales).',
      'Lo generado se guarda en «Diseños» del proyecto.',
    ],
  },
  {
    intent: 'plan',
    title: 'Empezar desde mi plano',
    summary:
      'Te llevo a la pestaña Plano: subes la imagen del plano en planta (foto, captura, PDF o boceto), la revisas y la envías al editor.',
    bullets: [
      'Si la lectura no es fiable, Jev te propone redibujarla con su precio antes de seguir.',
      'Corriges cotas y esquinas, y la envías al editor para verla en 3D.',
      'Desde el editor generas los diseños, y con los diseños aceptados, los vídeos.',
    ],
  },
];

export function StepIntent({ intent, pending, onPick }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-ink text-2xl font-semibold">Tu próximo espacio empieza aquí</h2>
        <p className="text-ink-soft text-sm">
          Elige por dónde empezamos. Podrás cambiar de idea más adelante sin perder lo que hayas
          hecho.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = option.intent === intent;
          return (
            <button
              key={option.intent}
              type="button"
              disabled={pending}
              aria-pressed={selected}
              onClick={() => onPick(option.intent)}
              className={`group overflow-hidden rounded-2xl border p-2 text-left transition-all focus-visible:outline-2 focus-visible:outline-brand-500 ${
                selected
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-line bg-surface hover:border-brand-500 hover:shadow-lg'
              } ${pending ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
            >
              <div className="mb-4 grid h-40 place-items-center overflow-hidden rounded-xl bg-sky-50" aria-hidden="true">
                {option.intent === 'design' ? <div className="w-full max-w-64"><CatalogNavigationImage room="salon" /></div> : <div className="rotate-[-6deg] rounded-2xl border-2 border-sky-200 bg-white p-5 shadow-sm"><ScanLine size={84} className="text-sky-600" strokeWidth={1} /></div>}
              </div>
              <div className="px-3 pb-3"><h3 className="text-ink text-base font-semibold">{option.title}</h3>
              <p className="text-ink-soft mt-2 text-sm leading-relaxed">{option.summary}</p>
              <ul className="text-ink-soft mt-3 list-disc space-y-1 pl-4 text-xs">
                {option.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul><span className="mt-5 flex items-center justify-between text-sm font-semibold text-brand-700">{pending ? 'Preparando…' : 'Empezar'}<ArrowRight size={18} /></span></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
