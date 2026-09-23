'use client';

/**
 * Paso 1 de la ruta del plano: subir el plano en planta.
 *
 * La lectura es cara y lenta, así que aquí se explica qué imagen funciona bien
 * antes de gastar una llamada. La subida reutiliza `ImageUpload`, que ya pide el
 * consentimiento de tratamiento de imágenes.
 */
import { ImageUpload, type UploadedImage } from './image-upload';
import { StepHeading } from './step-layout';

interface Props {
  pending: boolean;
  error: string | null;
  onUpload: (image: UploadedImage) => void;
}

export function StepPlanUpload({ pending, error, onUpload }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeading step={1} intent="plan">
        Sube el plano en planta de tu vivienda (una foto nítida, una captura o un plano
        exportado). Leeré los muros, las puertas, las ventanas, las estancias y las medidas
        escritas.
      </StepHeading>

      <ul className="border-line bg-surface-muted text-ink-soft rounded-control border p-3 text-xs">
        <li>Mejor si se ve el plano entero y recto, sin sombras ni dedos por medio.</li>
        <li>Si el plano trae cotas escritas, las usaré para ajustar las medidas.</li>
        <li>Esto no es una foto del ambiente: para eso está la otra ruta del asistente.</li>
      </ul>

      <ImageUpload onUpload={onUpload} disabled={pending} />

      {pending ? (
        <p className="text-ink-soft text-sm">
          Leyendo el plano y comprobando lo fiel que ha salido. Tarda unos segundos.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-control border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
