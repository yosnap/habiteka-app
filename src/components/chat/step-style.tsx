'use client';

/**
 * Paso 3: elección del estilo con la misma galería visual que se usa al generar
 * desde el editor (un solo sitio de verdad), más una frase que explica el estilo
 * seleccionado para que la decisión no dependa solo de la miniatura.
 */
import { StyleGallery } from '@/components/canvas/style-gallery';
import { estiloDescripcion, estiloLabel } from '@/lib/design-options';
import { StepHeading, StepNav } from './step-layout';
import type { Estilo } from '@/lib/contracts';

interface Props {
  estilo?: Estilo;
  pending: boolean;
  onPick: (estilo: Estilo) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepStyle({ estilo, pending, onPick, onBack, onNext }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeading step={3}>
        Elige el aire que quieres para tu espacio. Toca una imagen para verla seleccionada; podrás
        cambiarlo y generar otra variante más adelante.
      </StepHeading>

      <StyleGallery value={estilo} onChange={onPick} disabled={pending} />

      {estilo ? (
        <div className="bg-brand-50 rounded-control p-3 text-sm">
          <p className="text-ink font-medium">{estiloLabel(estilo)}</p>
          <p className="text-ink-soft">{estiloDescripcion(estilo)}</p>
        </div>
      ) : null}

      <StepNav
        onBack={onBack}
        onNext={onNext}
        backLabel="Volver a mi espacio"
        disabled={pending}
        nextDisabled={estilo === undefined}
        hint="Elige un estilo para continuar."
      />
    </div>
  );
}
