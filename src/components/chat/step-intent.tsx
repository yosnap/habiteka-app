'use client';

/**
 * Paso 0 del asistente: qué quiere hacer el usuario.
 *
 * Es la bifurcación de todo lo que viene después, así que se explica con
 * palabras llanas qué hace cada ruta y qué se obtiene al final. La elección se
 * guarda en el servidor (`set-intent`) para retomarla al recargar.
 */
import type { AssistantIntent } from '@/lib/contracts';

interface Props {
  /** Ruta ya elegida (al volver a cambiarla), para marcarla como seleccionada. */
  intent?: AssistantIntent;
  pending: boolean;
  onPick: (intent: AssistantIntent) => void;
}

const OPTIONS: ReadonlyArray<{
  intent: AssistantIntent;
  icon: string;
  title: string;
  summary: string;
  bullets: readonly string[];
}> = [
  {
    intent: 'design',
    icon: '📷',
    title: 'Crear un diseño a partir de una foto',
    summary:
      'Súbeme una foto de la estancia tal y como está y te propongo cómo puede quedar con el estilo que elijas.',
    bullets: [
      'Miro la foto y te digo qué he reconocido para que lo corrijas si hace falta.',
      'Eliges estilo y qué quieres recibir (imagen del ambiente, plano, memoria de materiales).',
      'Lo generado se guarda en «Diseños» del proyecto.',
    ],
  },
  {
    intent: 'plan',
    icon: '📐',
    title: 'Convertir mi plano al editor',
    summary:
      'Súbeme el plano en planta de tu vivienda y lo paso a muros, puertas, ventanas y estancias editables.',
    bullets: [
      'Compruebo lo fiel que ha salido la lectura antes de seguir.',
      'Lo llevo al editor, donde puedes ajustarlo y verlo en 3D.',
      'Desde ahí generas diseños partiendo de tu plano real.',
    ],
  },
];

export function StepIntent({ intent, pending, onPick }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-ink text-base font-semibold">¿Qué quieres hacer?</h2>
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
              className={`rounded-card border p-4 text-left transition-colors ${
                selected
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-line bg-surface hover:border-brand-500'
              } ${pending ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
            >
              <p className="mb-1 text-2xl" aria-hidden>
                {option.icon}
              </p>
              <h3 className="text-ink text-sm font-semibold">{option.title}</h3>
              <p className="text-ink-soft mt-1 text-xs">{option.summary}</p>
              <ul className="text-ink-soft mt-2 list-disc space-y-0.5 pl-4 text-xs">
                {option.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
