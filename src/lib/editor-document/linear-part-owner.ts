import type { EditorDocument, Furniture } from './schema';
import { boundaryGateOwner } from './boundary-types';
import { putBoundaryGate } from './boundary-commands';
import { kitchenSlotOwner } from './kitchen-run-types';
import { putKitchenSlot } from './kitchen-run-commands';

/** Pieza que vive sobre un objeto lineal (puerta de cerramiento, aparato de cocina): se arrastra a lo largo de su tramo. */
export interface LinearPartOwner { item: Furniture; positionMm: number; move: (doc: EditorDocument, deltaMm: number) => EditorDocument }
export function linearPartOwner(doc: EditorDocument, id: string | undefined): LinearPartOwner | undefined {
  const gate = boundaryGateOwner(doc, id);
  if (gate) return { item: gate.boundary, positionMm: gate.gate.positionMm, move: (d, delta) => putBoundaryGate(d, gate.boundary.id, { ...gate.gate, positionMm: gate.gate.positionMm + delta }) };
  const slot = kitchenSlotOwner(doc, id);
  if (slot) return { item: slot.run, positionMm: slot.slot.positionMm, move: (d, delta) => putKitchenSlot(d, slot.run.id, { ...slot.slot, positionMm: slot.slot.positionMm + delta }) };
  return undefined;
}
