'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { callAction } from '@/lib/action-result';
import { closeRoofFromModel } from '@/app/(app)/projects/[id]/_actions/roof-closure-actions';
import { isInteriorRenderMode, renderDesignOptionsSchema, zoneCompositeActive } from '@/lib/editor-document/render-design-options';
import type { DeliverableView } from './deliverables-panel';

/** Isométrica o dron aceptados de toda la planta y todavía sin cubierta: los únicos que admiten cerrar el tejado. */
export function canCloseRoof(item: DeliverableView, accepted: boolean): boolean {
  if (!accepted || item.payload.type !== 'render3d') return false;
  const generation = item.payload.generation, options = renderDesignOptionsSchema.safeParse(generation?.options ?? {});
  return ['isometric', 'drone'].includes(generation?.view?.preset ?? '') && generation?.view?.ceilingView !== 'solid'
    && !generation?.roofClosure && options.success && !isInteriorRenderMode(options.data) && !zoneCompositeActive(options.data);
}

/** La cubierta sale del plano; la IA la añade a la imagen aceptada y una revisión comprueba el resultado. */
export function RoofClosureButton({ projectId, item }: { projectId: string; item: DeliverableView }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; error?: string; done?: boolean }>({ busy: false });
  const close = async () => {
    setState({ busy: true });
    try {
      await callAction(closeRoofFromModel(projectId, item.zoneId, item.id));
      setState({ busy: false, done: true });
      router.refresh();
    } catch (cause) {
      setState({ busy: false, error: cause instanceof Error ? cause.message : 'No se pudo cerrar el tejado. Inténtalo de nuevo.' });
    }
  };
  return <div className="flex flex-col items-start gap-1">
    {!state.done && <Button type="button" size="sm" variant="secondary" onClick={close} disabled={state.busy}>
      {state.busy ? 'Cerrando el tejado…' : 'Cerrar tejado desde el modelo'}
    </Button>}
    <p className="text-xs text-ink-soft">La IA añade a esta imagen la cubierta del plano, con su forma, claraboyas y chimeneas; una revisión comprueba la cubierta y que el resto no cambie. Tiene el coste de una imagen y una revisión.</p>
    {state.done && <p className="text-xs text-ink-soft" role="status">Imagen con tejado creada en esta tanda. Revísala y acéptala antes de usarla en el vídeo.</p>}
    {state.error && <p className="text-destructive text-xs" role="alert">{state.error}</p>}
  </div>;
}
