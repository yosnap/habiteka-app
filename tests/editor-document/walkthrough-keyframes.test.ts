import { describe, expect, it } from 'vitest';
import { cameraPoseFromView, cameraPoseSchema } from '@/lib/contracts/walkthrough-keyframe';
import { renderViewSchema, type RenderView } from '@/lib/editor-document/render-view';
import { walkthroughKeyframes } from '@/lib/editor-document/walkthrough-keyframes';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { waypoint } from '@/lib/editor-document/walkthrough';
import { addBuildingLevel } from '@/lib/editor-document/building-levels';

const view: RenderView = { preset:'custom',position:[2,1.6,3],quaternion:[0,0,0,1],fov:75,aspect:16/9,allLevels:false,cutaway:false };
const room = () => addWallPath(emptyEditorDocument(),[{x:0,y:0},{x:5000,y:0},{x:5000,y:5000},{x:0,y:5000}],true);
const route = () => ({id:'r',name:'Ruta',zoneIds:[],loop:false,waypoints:[waypoint({x:1000,y:2000}),waypoint({x:3000,y:2000})]});
describe('poses de vistas del recorrido', () => {
  it('recupera la mirada de capturas antiguas sin foco ni planta', () => {
    expect(cameraPoseFromView(view)).toEqual({position:[2,1.6,3],focus:[2,1.6,2],fovDeg:75,levelId:null});
    expect(renderViewSchema.parse(view)).toEqual(view);
  });
  it('normaliza la elevación global para guardar coordenadas de planta', () => {
    const pose=cameraPoseFromView({...view,position:[2,4.6,3],focus:[4,4.6,3],levelElevationM:3,levelId:'upper',allLevels:true});
    expect(pose.position[1]).toBeCloseTo(1.6);expect(pose.focus[1]).toBeCloseTo(1.6);
    expect(pose.levelId).toBe('upper');
  });
  it('rechaza mirada nula, valores no finitos y quaternion degenerado', () => {
    const pose=cameraPoseFromView(view);
    expect(()=>cameraPoseSchema.parse({...pose,focus:pose.position})).toThrow();
    expect(()=>cameraPoseSchema.parse({...pose,fovDeg:NaN})).toThrow();
    expect(()=>cameraPoseFromView({...view,quaternion:[0,0,0,0]})).toThrow();
  });
  it('extrae un encuadre por punto sin alterar documento ni ruta', () => {
    const doc=room(),path=route(),before=JSON.stringify({doc,path}),frames=walkthroughKeyframes(doc,path);
    expect(frames).toHaveLength(2);expect(frames[0]!.camera.position).toEqual([1,1.6,2]);
    expect(frames[1]!.camera.position).toEqual([3,1.6,2]);
    expect(frames[0]!.camera.fovDeg).toBe(75);
    expect(JSON.stringify({doc,path})).toBe(before);
  });
  it('identifica planta superior conservando altura relativa al suelo', () => {
    const doc=addBuildingLevel(room(),true);
    const frames=walkthroughKeyframes(doc,route());
    expect(frames[0]!.camera.levelId).toBe(doc.activeLevelId);
    expect(frames[0]!.camera.position[1]).toBe(1.6);
  });
  it('bloquea capturas de una ruta que atraviesa un muro', () => {
    const path=route();path.waypoints[1]!.x=6000;
    expect(()=>walkthroughKeyframes(room(),path)).toThrow(/bloqueados/);
  });
});
