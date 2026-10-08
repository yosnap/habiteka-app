import { Button } from '@/components/ui/button';

interface Props {
  projectId: string;
  hasSource: boolean;
  hasImport: boolean;
  hasEditorPlan: boolean;
  fromDrawing: boolean;
  confirmSend: boolean;
  busy: boolean;
  onReview: () => void;
  onExtract: () => void;
  onSendDrawing: () => void;
  onCancelSend: () => void;
}

/** Una sola acción principal para avanzar, sin confundir render con plano editable. */
export function StudioNextStep({
  projectId,
  hasSource,
  hasImport,
  hasEditorPlan,
  fromDrawing,
  confirmSend,
  busy,
  onReview,
  onExtract,
  onSendDrawing,
  onCancelSend,
}: Props) {
  return (
    <section
      aria-label="Siguiente paso"
      className="border-line bg-brand-50 rounded-card border p-4"
    >
      <h2 className="text-ink text-sm font-semibold">Siguiente paso</h2>
      {!hasSource ? (
        <p className="text-ink-soft mt-2 text-xs">
          Sube un plano nuevo o elige «Usar este plano» en los resultados guardados.
        </p>
      ) : hasImport ? (
        <>
          <p className="text-ink-soft my-2 text-xs">
            Revisa las medidas extraídas y confirma antes de reemplazar el plano del editor.
          </p>
          <Button size="sm" className="w-full" disabled={busy} onClick={onReview}>
            Revisar medidas
          </Button>
        </>
      ) : hasEditorPlan ? (
        <>
          <p className="text-ink-soft my-2 text-xs">
            El plano editable está listo. Continúa en el editor para ajustar distribución y muebles.
          </p>
          <Button size="sm" className="w-full" asChild>
            <a href={`/projects/${projectId}`}>Abrir editor</a>
          </Button>
        </>
      ) : fromDrawing ? (
        <>
          <p className="text-ink-soft my-2 text-xs">
            {confirmSend
              ? 'Se reemplazará el plano actual del editor. ¿Continuar?'
              : 'El boceto ya tiene muros vectoriales. Puedes enviarlos al editor para ajustarlos.'}
          </p>
          <Button size="sm" className="w-full" disabled={busy} onClick={onSendDrawing}>
            {confirmSend ? 'Sí, reemplazar y abrir editor' : 'Enviar al editor'}
          </Button>
          {confirmSend ? (
            <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={onCancelSend}>
              Cancelar
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-ink-soft my-2 text-xs">
            Extrae muros y cotas de este plano. Después podrás corregir las medidas antes de editar.
          </p>
          <Button size="sm" className="w-full" disabled={busy} onClick={onExtract}>
            Extraer y revisar medidas
          </Button>
          <p className="text-ink-soft mt-2 text-xs">
            No genera imágenes: hace una lectura con IA de visión, que el proveedor cobra por uso
            (céntimos). El redibujado previo es opcional; el técnico suele facilitar la revisión.
          </p>
        </>
      )}
    </section>
  );
}
