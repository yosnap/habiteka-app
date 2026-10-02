import { describe, expect, it } from 'vitest';
import { Group, Mesh, MeshStandardMaterial, BoxGeometry } from 'three';
import { prepareConstructionAnimation, constructionProgress } from '@/components/editor-v2/scene/construction-animation';
import { constructionAudioSamples } from '@/components/editor-v2/scene/construction-audio';
import { constructionFrame } from '@/components/editor-v2/scene/construction-timeline';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
describe('animación y sonido de construcción', () => {
  it('levanta un muro cada vez y sincroniza todos los fragmentos del mismo muro', () => {
    const scene = new Group();
    const walls = ['a', 'a', 'b', 'c'].map(key => {
      const wall = new Group(); wall.userData = { videoStage: 1, buildKey: key }; scene.add(wall); return wall;
    });
    const animation = prepareConstructionAnimation(scene);
    expect(animation.wallCount).toBe(3);
    animation.apply(1, .5, false);
    expect(walls[0]!.scale.y).toBe(1); expect(walls[1]!.scale.y).toBe(1);
    expect(walls[2]!.scale.y).toBe(.5); expect(walls[3]!.visible).toBe(false);
    for (let step = 0; step < 100; step++) {
      animation.apply(1, step / 100, false);
      const growing = new Set(walls.filter(wall => wall.visible && wall.scale.y < 1).map(wall => wall.userData.buildKey));
      expect(growing.size).toBeLessThanOrEqual(1);
    }
    animation.restore(); expect(walls.every(wall => wall.visible && wall.scale.y === 1)).toBe(true);
  });
  it('conserva el recorte de ámbito y no resucita objetos excluidos al promocionar', () => {
    const scene = new Group(), excluded = new Group(); excluded.visible = false; excluded.userData.videoStage = 3; scene.add(excluded);
    const material = new MeshStandardMaterial(), onBeforeCompile = material.onBeforeCompile = () => {};
    const group = new Group(), mesh = new Mesh(new BoxGeometry(), material); group.userData.videoStage = 2; group.add(mesh); scene.add(group);
    const animation = prepareConstructionAnimation(scene); animation.apply(3, 1, true);
    expect(excluded.visible).toBe(false);
    expect((mesh.material as MeshStandardMaterial).onBeforeCompile).toBe(onBeforeCompile);
    animation.restore(); expect(mesh.material).toBe(material); expect(excluded.visible).toBe(false);
  });
  it('mantiene fija la cámara durante los muros y empieza el vuelo con la casa terminada', () => {
    const doc = { ...emptyEditorDocument(), vertices: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4000, y: 5000 }] };
    expect(constructionFrame(doc, 1300).stage).toBe(1);
    expect(constructionFrame(doc, 2000).position).toEqual(constructionFrame(doc, 4200).position);
    expect(constructionFrame(doc, 4300).stage).toBe(2);
    expect(constructionFrame(doc, 6000).stageProgress).toBe(1);
    expect(constructionFrame(doc, 7900).position).not.toEqual(constructionFrame(doc, 4200).position);
  });
  it('pone un efecto al inicio de cada muro, con silencio entre muros y sin saturar', () => {
    const samples = constructionAudioSamples(8, false, 1, 1000, 1, 3, true);
    for (const start of [1300, 2300, 3300]) {
      expect(samples.slice(start, start + 350).some(value => value !== 0)).toBe(true);
      expect(samples.slice(start + 400, start + 950).every(value => value === 0)).toBe(true);
    }
    expect(Math.max(...samples.map(Math.abs))).toBeLessThan(1);
    expect(samples.slice(6200).every(value => value === 0)).toBe(true);
  });
  it('mantiene los muros en tres segundos y dedica más tiempo a muebles en la versión de 12 s', () => {
    const doc = { ...emptyEditorDocument(), vertices: [{ id: 'a', x: 0, y: 0 }] };
    const options = { constructionDurationSeconds: 12 as const };
    expect(constructionFrame(doc, 1500, [], options)).toMatchObject({ stage: 1, stageProgress: 0 });
    expect(constructionFrame(doc, 4500, [], options).stage).toBe(2);
    expect(constructionFrame(doc, 7250, [], options)).toMatchObject({ stage: 3, stageProgress: .5 });
    expect(constructionFrame(doc, 8900, [], options).position).toEqual(constructionFrame(doc, 1500, [], options).position);
    expect(constructionFrame(doc, 11000, [], options).position).not.toEqual(constructionFrame(doc, 8900, [], options).position);
    const samples = constructionAudioSamples(12, false, 1, 1000, 1, 3, true, options);
    for (const start of [1500, 2500, 3500]) expect(samples.slice(start, start + 350).some(value => value !== 0)).toBe(true);
    expect(samples.slice(9200).every(value => value === 0)).toBe(true);
  });
  it('hace crecer un muro conservando su base y restaura la escena al terminar', () => {
    const scene = new Group(), wall = new Group();
    wall.position.y = 3; wall.userData = { videoStage: 1, buildBaseM: 2, buildKey: 'wall' };
    scene.add(wall);
    const animation = prepareConstructionAnimation(scene);
    animation.apply(1, .5, false);
    expect(wall.scale.y).toBeGreaterThan(0); expect(wall.scale.y).toBeLessThan(1);
    expect(wall.position.y + 2 * wall.scale.y).toBeCloseTo(5);
    animation.apply(1, 1, false); expect(wall.scale.y).toBe(1);
    animation.restore(); expect(wall.position.y).toBe(3); expect(wall.scale.y).toBe(1);
  });
  it('funde los acabados sin cambiar los materiales compartidos y restaura su identidad', () => {
    const scene = new Group(), group = new Group(), material = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(), material); group.userData.videoStage = 2; group.add(mesh); scene.add(group);
    const animation = prepareConstructionAnimation(scene); animation.apply(2, .5, false);
    expect((mesh.material as MeshStandardMaterial).opacity).toBe(.5); expect(material.opacity).toBe(1);
    animation.restore(); expect(mesh.material).toBe(material);
  });
  it('no hace aparecer muros al inicio de su fase y los completa antes de la siguiente', () => {
    for (const key of ['wall-a', 'wall-b', 'wall-c']) {
      expect(constructionProgress(1, 0, key)).toBe(0);
      expect(constructionProgress(1, 1, key)).toBe(1);
    }
  });
  it('sincroniza efectos con la obra y conserva silencio fuera de ella, sin saturación', () => {
    const samples = constructionAudioSamples(30, true, 1, 1000);
    expect(samples.length).toBe(30000);
    expect(samples.slice(0, 6000).some(value => value !== 0)).toBe(false);
    expect(samples.slice(6000, 25000).some(value => value !== 0)).toBe(true);
    expect(samples.slice(25300).some(value => value !== 0)).toBe(false);
    expect(Math.max(...samples.map(Math.abs))).toBeLessThan(1);
    expect(constructionAudioSamples(4, false, 0, 1000).every(value => value === 0)).toBe(true);
  });
});
