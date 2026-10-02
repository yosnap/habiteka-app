import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { waitSceneModels } from '@/components/editor-v2/scene/wait-scene-models';
afterEach(() => vi.useRealTimers());
describe('promotion model readiness', () => {
  it('waits for model loading before allowing recording', async () => {
    vi.useFakeTimers();
    const scene = new Group(), model = new Group(); scene.add(model);
    model.userData.modelLoadState = 'loading';
    const result = waitSceneModels(scene, new AbortController().signal);
    model.userData.modelLoadState = undefined;
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBeUndefined();
  });
  it('rejects unavailable models rather than recording their simplified fallback', async () => {
    const scene = new Group(); scene.userData.modelLoadState = 'failed';
    await expect(waitSceneModels(scene, new AbortController().signal)).rejects.toThrow(/todos los elementos/);
  });
  it('honours cancellation before recording', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(waitSceneModels(new Group(), controller.signal)).rejects.toThrow();
  });
  it('espera la textura y rechaza una cubierta inválida antes de codificar', async () => {
    vi.useFakeTimers();
    const scene = new Group(), material = new MeshStandardMaterial(), mesh = new Mesh(undefined, material);
    scene.add(mesh); material.userData.textureLoadState = 'loading';
    const result = waitSceneModels(scene, new AbortController().signal);
    delete material.userData.textureLoadState;
    await vi.advanceTimersByTimeAsync(100); await expect(result).resolves.toBeUndefined();
    scene.userData.roofError = 'Revisa el tejado';
    await expect(waitSceneModels(scene, new AbortController().signal)).rejects.toThrow('Revisa el tejado');
  });
});
