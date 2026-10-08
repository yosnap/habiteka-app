import type { Deliverable } from '@/lib/contracts';
import { RENDER_VIEW_LABELS } from './render-design-options';

type ScopedDeliverable = Deliverable & { zoneId: string | null };
export function renderImageLabel(deliverable: Deliverable): { zone: string; view: string } {
  const generation = deliverable.payload.type === 'render3d' ? deliverable.payload.generation : undefined;
  const zones = generation?.options?.placement === 'selected' ? generation.options.regions.map(region => region.name) : [];
  const scopeLabel = zones.length > 3 ? `${zones.slice(0, 2).join(', ')} y ${zones.length - 2} zonas más` : zones.join(', ');
  const scope = generation?.options?.designScope;
  const fallback = scope === 'house' ? 'Solo la casa' : scope === 'interior' ? 'Interiores'
    : scope === 'exterior' ? 'Exterior' : scope === 'rooms' ? 'Estancias seleccionadas'
      : scope === 'zone' || generation?.options?.placement === 'selected' ? 'Zonas seleccionadas'
        : generation?.options ? 'Toda la planta' : 'Ámbito sin registrar';
  const zone = generation?.view?.roomName || scopeLabel || fallback;
  const preset = generation?.view?.preset;
  const view = preset === 'custom' && generation?.view?.roomName ? 'Interior · altura de ojos'
    : preset && preset in RENDER_VIEW_LABELS ? RENDER_VIEW_LABELS[preset as keyof typeof RENDER_VIEW_LABELS]
      : preset === 'custom' ? 'Cámara personalizada' : 'Vista sin registrar';
  return { zone, view };
}

/** El orden de las tandas respeta el listado; una revisión o zona por sí sola no identifica una tanda. */
export function groupDeliverables<T extends ScopedDeliverable>(items: T[]): { key: string; items: T[] }[] {
  const groups = new Map<string, { key: string; items: T[] }>();
  for (const item of items) {
    const batch = item.payload.type === 'render3d' ? item.payload.generation?.batchId : undefined;
    const key = batch ? JSON.stringify([item.zoneId, batch]) : item.id;
    const group = groups.get(key);
    if (group) group.items.push(item); else groups.set(key, { key, items: [item] });
  }
  return [...groups.values()];
}
