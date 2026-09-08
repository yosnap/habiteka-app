import { emptyCanvasDoc, type CanvasDoc } from '@/canvas/types';
import type { Plano2dPayload } from '@/lib/contracts/plano2d-payload';

/** Sintética: no representa la distribución de la imagen privada del usuario. */
export const metricRectangle: Plano2dPayload = {
  schemaVersion: 1,
  zones: [{
    id: 'room', name: 'Habitación de prueba',
    outline: [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }],
    walls: [
      { id: 'north', from: { x: 0, y: 0 }, to: { x: 6000, y: 0 }, thicknessMm: 150 },
      { id: 'east', from: { x: 6000, y: 0 }, to: { x: 6000, y: 4000 }, thicknessMm: 150 },
      { id: 'south', from: { x: 6000, y: 4000 }, to: { x: 0, y: 4000 }, thicknessMm: 150 },
      { id: 'west', from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thicknessMm: 150 },
    ],
    apertures: [
      { id: 'door', kind: 'puerta', wallId: 'south', position: 0.25, widthMm: 900 },
      { id: 'window', kind: 'ventana', wallId: 'north', position: 0.5, widthMm: 1200 },
      { id: 'passage', kind: 'hueco', wallId: 'east', position: 0.5, widthMm: 1000 },
    ],
    dimensions: [{ id: 'width', from: { x: 0, y: 0 }, to: { x: 6000, y: 0 }, label: '6.00 m' }],
  }],
};

export const furnishedCanvas: CanvasDoc = {
  ...emptyCanvasDoc(),
  scale: { pxPerMeter: 100, ratio: 50 },
  objects: [
    { id: 'north', kind: 'wall', x: 0, y: 0, width: 600, height: 15, rotation: 0 },
    // Ejes de muro conectados: el pivote legacy está en la esquina, no en el eje.
    { id: 'east', kind: 'wall', x: 607.5, y: 7.5, width: 400, height: 15, rotation: 90 },
    { id: 'sofa', kind: 'sofa', x: 100, y: 100, width: 200, height: 90, rotation: 30 },
  ],
};
