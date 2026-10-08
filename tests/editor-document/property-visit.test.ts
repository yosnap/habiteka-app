import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { propertyVisitEntries } from '@/lib/editor-document/property-visit-entries';
import { planPropertyVisit } from '@/lib/editor-document/property-visit-plan';
import { propertyVisitReferenceCoverage } from '@/lib/editor-document/property-visit-references';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { addBuildingLevel } from '@/lib/editor-document/building-levels';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { propertyVisitFrames } from '@/lib/editor-document/property-visit-frames';
import { propertyVisitDocument } from '@/lib/editor-document/property-visit-document';

function house() {
  const doc = emptyEditorDocument();
  doc.vertices = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 0 }, { id: 'c', x: 8000, y: 0 },
    { id: 'd', x: 0, y: 4000 }, { id: 'e', x: 4000, y: 4000 }, { id: 'f', x: 8000, y: 4000 }];
  doc.walls = [['a', 'b'], ['b', 'c'], ['d', 'e'], ['e', 'f'], ['a', 'd'], ['b', 'e'], ['c', 'f']]
    .map(([a, b], i) => ({ id: `w${i}`, startVertexId: a!, endVertexId: b!, thicknessMm: 150, dimensionalOrigin: 'physical' as const }));
  doc.openings = [4, 5].map(i => ({ id: `door${i}`, wallId: `w${i}`, kind: 'puerta' as const, position: .5,
    widthMm: 1200, dimensionalOrigin: 'physical' as const }));
  doc.furniture = [{ id: 'porch', kind: 'porche-entrada', catalogId: 'habiteka:outdoor:porche-entrada',
    x: -2200, y: 800, widthMm: 2200, depthMm: 2400, rotation: 0, dimensionalOrigin: 'physical' }];
  const upgraded = upgradeSpatialDocument(doc);
  upgraded.furniture[0]!.heightMm = 2800;
  return upgraded;
}

describe('paseo completo desde el exterior', () => {
  it('pide elegir una entrada y conserva todas las zonas sin afirmar cobertura', () => {
    const plan = planPropertyVisit(house());
    expect(plan.complete).toBe(false); expect(plan.coverage).toHaveLength(2);
    expect(plan.frames).toEqual([]); expect(plan.issues[0]).toContain('Elige el acceso');
  });
  it('entra por una puerta real y agrupa todas las estancias en un paseo de hasta un minuto', () => {
    const doc = house(), original = structuredClone(doc), nav = walkthroughNavigation(doc);
    const entries = propertyVisitEntries(doc);
    expect(entries).toHaveLength(1); expect(entries[0]?.issue).toBeUndefined();
    const plan = planPropertyVisit(doc, 'door4');
    expect(plan.complete).toBe(true); expect(plan.coverage.every(room => room.status === 'planned')).toBe(true);
    expect(plan.frames[0]?.camera.position[0]).toBeLessThan(0);
    expect(plan.durationSeconds).toBeLessThanOrEqual(60);
    expect(plan.frames.length).toBeLessThanOrEqual(11);
    expect(plan.pathFrames?.some(frame => frame.label.includes('observar la zona'))).toBe(true);
    const path = plan.pathFrames!;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!.camera.position, b = path[i]!.camera.position;
      expect(nav.segmentFree({ x: a[0] * 1000, y: a[2] * 1000 }, { x: b[0] * 1000, y: b[2] * 1000 })).toBe(true);
    }
    expect(doc).toEqual(original);
  });
  it('no oculta una estancia aislada ni declara un recorrido completo', () => {
    const doc = house(); doc.openings = doc.openings.filter(door => door.id !== 'door5');
    const plan = planPropertyVisit(doc, 'door4');
    expect(plan.complete).toBe(false); expect(plan.coverage).toHaveLength(2);
    expect(plan.coverage.filter(room => room.status === 'pending')).toHaveLength(1);
    expect(plan.issues.join()).toContain('1 zonas sin recorrido');
  });
  it('una entrada cerrada bloquea la preparación sin abrirla ni atravesarla', () => {
    const doc = house(); doc.openings[0]!.openAngleDeg = 0;
    const plan = planPropertyVisit(doc, 'door4');
    expect(plan.complete).toBe(false); expect(plan.frames).toEqual([]);
    expect(plan.issues.join()).toContain('cerrada'); expect(doc.openings[0]!.openAngleDeg).toBe(0);
  });
  it('puede preparar puertas abiertas como estado de la visita sin cambiar el plano', () => {
    const doc = house(); doc.openings[0]!.openAngleDeg = 0;
    const scene = propertyVisitDocument(doc, true);
    expect(scene.openedDoorIds).toEqual(['door4']);
    expect(planPropertyVisit(scene.document, 'door4').complete).toBe(true);
    expect(doc.openings[0]!.openAngleDeg).toBe(0);
  });
  it('une el suelo del porche con la habitación a través del grosor real de la pared', () => {
    const doc = house(); doc.furniture[0]!.widthMm = 2125;
    expect(walkthroughNavigation(doc).segmentFree({ x: -500, y: 2000 }, { x: 500, y: 2000 })).toBe(true);
    doc.furniture[0]!.widthMm = 2000;
    expect(walkthroughNavigation(doc).segmentFree({ x: -500, y: 2000 }, { x: 500, y: 2000 })).toBe(false);
  });
  it('permite un umbral de 20 cm con apoyo y altura, pero bloquea desniveles excesivos o ventanas', () => {
    const doc = house(); doc.openings[1]!.elevationMm = 200;
    const a = { x: 3500, y: 2000 }, b = { x: 4500, y: 2000 };
    expect(walkthroughNavigation(doc).segmentFree(a, b)).toBe(true);
    expect(walkthroughNavigation(doc).floorAt({ x: 4000, y: 2000 })).toBe(200);
    doc.openings[1]!.elevationMm = 300;
    expect(walkthroughNavigation(doc).segmentFree(a, b)).toBe(false);
    doc.openings[1]!.elevationMm = 200; doc.openings[1]!.heightMm = 1500;
    expect(walkthroughNavigation(doc).segmentFree(a, b)).toBe(false);
    doc.openings[1]!.heightMm = 2100; doc.openings[1]!.kind = 'ventana';
    expect(walkthroughNavigation(doc).segmentFree(a, b)).toBe(false);
  });
  it('no convierte el terreno decorativo en un suelo transitable ni una ventana en una entrada', () => {
    const doc = house(); doc.furniture = [];
    doc.terrainSurfaces = [{ id: 'terrain', name: 'Visual', x: -5000, y: -5000, widthMm: 20000, depthMm: 20000,
      color: '#ffffff', texture: 'none', tileSizeMm: 1000, rotation: 0 }];
    expect(planPropertyVisit(doc, 'door4').issues.join()).toContain('suelo transitable');
    doc.openings[0]!.kind = 'ventana'; expect(propertyVisitEntries(doc)).toEqual([]);
  });
  it('no omite las zonas de otra planta aunque la primera esté cubierta', () => {
    const doc = addBuildingLevel(house(), true), plan = planPropertyVisit(doc, 'door4');
    expect(plan.coverage).toHaveLength(4); expect(plan.complete).toBe(false);
    expect(plan.coverage.filter(room => room.issue?.includes('escalera'))).toHaveLength(2);
  });
  it('requiere la cámara y luz exactas: una referencia rechazada o de otra vista no cubre un giro', () => {
    const plan = planPropertyVisit(house(), 'door4'), camera = plan.frames[0]!.camera;
    const reference = { id: 'accepted', camera, lighting: 'daylight' as const, batchId: 'batch' };
    expect(propertyVisitReferenceCoverage(plan, [reference], 'daylight').matching[0]?.sourceIds).toEqual(['accepted']);
    expect(propertyVisitReferenceCoverage(plan, [{ ...reference, issue: 'Sin aceptación' }], 'daylight').matched).toBe(0);
    expect(propertyVisitReferenceCoverage(plan, [reference], 'warm').matched).toBe(0);
    expect(propertyVisitReferenceCoverage(plan, [{ ...reference, camera: { ...camera, position: [10, 1.6, 10] } }], 'daylight').matched).toBe(0);
  });
  it('después de varias vueltas orienta por el giro corto, sin acumular rotaciones innecesarias', () => {
    const camera = propertyVisitFrames(walkthroughNavigation(house()), 'ground', { x: 2000, y: 2000 }, 170);
    for (let i = 0; i < 4; i++) camera.inspect('Detalle');
    const start = camera.frames.length;
    camera.move([{ x: 1700, y: 2000 }], 'Salida');
    expect(camera.frames.slice(start).filter(frame => frame.label.includes('orientar'))).toHaveLength(2);
  });
});
