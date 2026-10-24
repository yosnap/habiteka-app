'use client';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { DerivedRoom } from '@/lib/editor-document/rooms';
import { ModernSelect } from '@/components/ui/modern-select';
import { roomClassification, setSpaceClassification, type SpaceClassification } from '@/lib/editor-document/space-classification';

export function SceneSpaceClassification({ store, id, name, rooms, disabled }: {
  store: EditorStore; id: string; name: string; rooms: DerivedRoom[]; disabled: boolean;
}) {
  const doc = useStore(store, state => state.document);
  const room = rooms.find(item => item.id === id), zone = doc.designZones?.find(item => item.id === id);
  if (!room && !zone) return null;
  const value = room ? doc.floorFinishes?.find(finish => finish.roomId === id)?.classification : zone?.classification;
  const effective = room ? roomClassification(doc, room, rooms) : value;
  return <ModernSelect compact aria-label={`Tipo de espacio de ${name}`} disabled={disabled}
    value={value ?? 'auto'} onChange={event => {
      try { store.getState().apply(setSpaceClassification(store.getState().document, id, event.target.value as SpaceClassification | 'auto')); }
      catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo cambiar el tipo de espacio'); }
    }}>
    <option value="auto">Automático{effective && !value ? ` · ${effective === 'interior' ? 'Interior' : 'Exterior'}` : ''}</option>
    <option value="interior">Interior</option><option value="exterior">Exterior</option>
  </ModernSelect>;
}
