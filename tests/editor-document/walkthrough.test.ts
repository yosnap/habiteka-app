import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { applyCommand } from '@/lib/editor-document/commands';
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { putWalkthrough, waypoint } from '@/lib/editor-document/walkthrough';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { autoTour } from '@/lib/editor-document/auto-tour';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { addBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';

function threeRooms() {
  const doc = emptyEditorDocument();
  doc.vertices = [{id:'a',x:0,y:0},{id:'b',x:3000,y:0},{id:'c',x:6000,y:0},{id:'d',x:9000,y:0},
    {id:'e',x:0,y:4000},{id:'f',x:3000,y:4000},{id:'g',x:6000,y:4000},{id:'h',x:9000,y:4000}];
  doc.walls = [['a','b'],['b','c'],['c','d'],['e','f'],['f','g'],['g','h'],['a','e'],['b','f'],['c','g'],['d','h']]
    .map(([a,b],i)=>({id:`w${i}`,startVertexId:a!,endVertexId:b!,thicknessMm:150,dimensionalOrigin:'physical' as const}));
  doc.openings = [7,8].map((i)=>({id:`door${i}`,wallId:`w${i}`,kind:'puerta' as const,position:.5,widthMm:900,dimensionalOrigin:'physical' as const}));
  return doc;
}
describe('recorridos persistidos y navegación', () => {
  it('recorre tres estancias por sus puertas sin atravesar muros', () => {
    const doc = threeRooms(), rooms = deriveRooms(doc);
    expect(rooms).toHaveLength(3);
    const route = autoTour(doc, rooms.map((r)=>r.id)), compiled = buildWalkthrough(doc, route);
    expect(route.waypoints.length).toBeGreaterThanOrEqual(3);
    expect(compiled.invalidSegments).toEqual([]);
    const nav = walkthroughNavigation(doc);
    expect(compiled.samples.every((p)=>nav.free(p))).toBe(true);
    expect(compiled.durationMs).toBeGreaterThan(5000);
  });
  it('avisa si falta pasillo/estancia intermedia o una puerta está cerrada', () => {
    const doc = threeRooms(), rooms = deriveRooms(doc);
    expect(()=>autoTour(doc,[rooms[0]!.id,rooms[2]!.id])).toThrow(/conectadas/);
    doc.openings=[];
    expect(()=>autoTour(doc,rooms.map((r)=>r.id))).toThrow(/conectadas/);
  });
  it('una ventana no es un paso transitable', () => {
    const doc = threeRooms();doc.openings[0]!.kind='ventana';
    expect(()=>autoTour(doc,deriveRooms(doc).map((r)=>r.id))).toThrow(/conectadas/);
  });
  it('no suaviza una ruta atravesando una esquina ni permite muros/objetos', () => {
    const doc=threeRooms(), route={id:'route',name:'Manual',zoneIds:[],loop:false,
      waypoints:[waypoint({x:1000,y:1000}),waypoint({x:8000,y:1000})]};
    expect(buildWalkthrough(doc,route).invalidSegments).toEqual([0]);
    const nav=walkthroughNavigation(doc);
    expect(nav.free({x:3000,y:1000})).toBe(false);
    expect(nav.free({x:3000,y:2000})).toBe(true);
    doc.furniture.push({id:'box',kind:'armario',x:1200,y:1200,widthMm:600,depthMm:600,rotation:0,dimensionalOrigin:'physical'});
    expect(walkthroughNavigation(doc).free({x:1500,y:1500})).toBe(false);
  });
  it('respeta pausas, velocidad y coordenadas de cámara', () => {
    const doc=addWallPath(emptyEditorDocument(),[{x:0,y:0},{x:5000,y:0},{x:5000,y:5000},{x:0,y:5000}],true);
    const first={...waypoint({x:1000,y:2000}),dwellMs:1000};
    const route={id:'r',name:'Ruta',zoneIds:[],loop:false,waypoints:[first,waypoint({x:3000,y:2000})]};
    const compiled=buildWalkthrough(doc,route);
    expect(compiled.durationMs).toBeCloseTo(3000);
    expect(compiled.samplePose(500).position).toEqual([1,1.6,2]);
    expect(compiled.samplePose(3000).position[0]).toBeCloseTo(3);
  });
  it('schema9 es explícito; ruta sobrevive serializar, deshacer y cambiar planta', () => {
    const original=threeRooms(), route=autoTour(original,deriveRooms(original).map((r)=>r.id));
    const doc=putWalkthrough(original,route);
    expect(original.schemaVersion).toBe(2);expect(original.walkthroughs).toBeUndefined();
    expect(doc.schemaVersion).toBe(9);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    const store=createEditorStore(original);store.getState().apply(doc);store.getState().undo();
    expect(store.getState().document.walkthroughs).toBeUndefined();store.getState().redo();
    expect(store.getState().document.walkthroughs).toHaveLength(1);
    const upstairs=addBuildingLevel(doc);expect(upstairs.schemaVersion).toBe(9);expect(upstairs.walkthroughs).toEqual([]);
    const downstairs=switchBuildingLevel(upstairs,upstairs.levels![0]!.id);
    expect(downstairs.walkthroughs).toEqual([route]);
  });
  it('recalibrar mueve la ruta y su foco, pero mantiene altura y velocidad', () => {
    const doc=threeRooms(), route=autoTour(doc,deriveRooms(doc).map((r)=>r.id));
    route.waypoints[0]!.lookAt={x:1000,y:2000};
    const source=putWalkthrough(doc,route);
    source.calibration={mmPerPixel:10};
    const scaled=applyCommand(source,{type:'recalibrate',factor:2});
    const point=scaled.walkthroughs![0]!.waypoints[0]!;
    expect(point.x).toBe(route.waypoints[0]!.x*2);
    expect(point.lookAt).toEqual({x:2000,y:4000});
    expect(point.eyeHeightMm).toBe(1600);expect(point.speedMmPerS).toBe(1000);
  });
  it('una única estancia produce desplazamiento y las puertas cerradas bloquean', () => {
    const doc=threeRooms(),rooms=deriveRooms(doc);
    const route=autoTour(doc,[rooms[0]!.id]);
    expect(buildWalkthrough(doc,route).durationMs).toBeGreaterThan(1000);
    const upgraded=upgradeConstructionDocument(doc);
    upgraded.openings[0]!.openAngleDeg=0;
    expect(walkthroughNavigation(upgraded).free({x:3000,y:2000})).toBe(false);
  });
  it('bloquea un bucle de duración cero antes de animar la cámara', () => {
    const doc=threeRooms();
    const route={id:'zero',name:'Cero',zoneIds:[],loop:true,waypoints:[waypoint({x:1000,y:1000}),waypoint({x:1000,y:1000})]};
    expect(()=>buildWalkthrough(doc,route)).toThrow(/Separa los puntos/);
  });
  it('rechaza números no finitos e IDs duplicados', () => {
    const doc=threeRooms(),route=autoTour(doc,deriveRooms(doc).map((r)=>r.id));
    route.waypoints[0]!.x=NaN;expect(()=>putWalkthrough(doc,route)).toThrow();
    route.waypoints[0]!.x=1500;route.waypoints[1]!.id=route.waypoints[0]!.id;
    expect(()=>putWalkthrough(doc,route)).toThrow();
  });
});
