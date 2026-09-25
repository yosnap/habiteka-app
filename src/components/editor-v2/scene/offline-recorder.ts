import type { RootState } from '@react-three/fiber';
import { PerspectiveCamera, Vector2, Vector3, type Object3D } from 'three';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { WalkthroughPath } from '@/lib/editor-document/walkthrough';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { applyWalkPose } from './walk-camera';
import { showcaseFrame, SHOWCASE_INTRO_MS } from './showcase-timeline';
import { revealHiddenLighting } from './cutaway-wall';
import { nativeVideoDurationMs, type NativeVideoMode } from '@/lib/editor-document/native-video';

/** Render frame a frame; la velocidad del equipo no cambia el tiempo del vídeo. */
export async function recordWalkthrough(root: RootState, doc: EditorDocument, route: WalkthroughPath,
  elevationMm: number, signal: AbortSignal, progress: (value: number) => void, mode: NativeVideoMode = 'walkthrough'): Promise<Blob> {
  const compiled = buildWalkthrough(doc, route);
  if (compiled.invalidSegments.length) throw new Error('El recorrido cruza un obstáculo. Corrige los tramos marcados.');
  const introMs = mode === 'showcase' ? SHOWCASE_INTRO_MS : 0;
  const durationMs = nativeVideoDurationMs(compiled.durationMs, mode);
  if (compiled.durationMs < 100 || durationMs > 60000) throw new Error('El vídeo debe durar entre 0,1 y 60 segundos. Ajusta la velocidad o los puntos.');
  if (mode === 'showcase' && !doc.vertices.length) throw new Error('Dibuja el inmueble antes de crear el vídeo de construcción.');
  if (typeof VideoEncoder === 'undefined') throw new Error('Este navegador no permite exportar H.264. Usa un navegador con WebCodecs.');
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, canEncodeVideo } = await import('mediabunny');
  const width = 1920, height = 1080, fps = 30;
  if (!await canEncodeVideo('avc', { width, height, bitrate: 6_000_000 })) throw new Error('H.264 a 1080p no está disponible en este navegador.');
  const { gl, scene, camera } = root;
  if (!(camera instanceof PerspectiveCamera)) throw new Error('Cámara no compatible');
  // R3F puede reajustar el tamaño del canvas WebGL al viewport entre fotogramas.
  // El encoder recibe siempre un lienzo fijo para mantener el MP4 a 1080p.
  const videoCanvas = document.createElement('canvas');
  videoCanvas.width = width; videoCanvas.height = height;
  const videoContext = videoCanvas.getContext('2d');
  if (!videoContext) throw new Error('No se pudo preparar el lienzo del vídeo.');
  const size = gl.getSize(new Vector2()), dpr = gl.getPixelRatio(), aspect = camera.aspect, fov = camera.fov;
  const position = camera.position.clone(), quaternion = camera.quaternion.clone();
  const orbit = root.controls as unknown as { enabled: boolean; target: Vector3; update: () => void } | null;
  const enabled = orbit?.enabled, target = orbit?.target.clone();
  const staged: { object: Object3D; visible: boolean; stage: number }[] = [];
  if (mode === 'showcase') scene.traverse((object) => {
    const stage = object.userData.videoStage;
    if (typeof stage === 'number') staged.push({ object, visible: object.visible, stage });
  });
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const restoreLighting = revealHiddenLighting(scene);
  try {
    if (orbit) orbit.enabled = false;
    gl.setPixelRatio(1); gl.setSize(width, height, false); camera.aspect = width / height; camera.fov = 75; camera.updateProjectionMatrix();
    const source = new CanvasSource(videoCanvas, { codec: 'avc', bitrate: 6_000_000 });
    output.addVideoTrack(source, { frameRate: fps }); await output.start();
    const frames = Math.ceil(durationMs / 1000 * fps);
    for (let frame = 0; frame < frames; frame++) {
      signal.throwIfAborted();
      if (gl.getContext().isContextLost()) throw new Error('Se interrumpió la vista 3D durante la exportación');
      if (gl.domElement.width !== width || gl.domElement.height !== height) gl.setSize(width, height, false);
      const elapsedMs = frame / fps * 1000;
      if (elapsedMs < introMs) {
        const shot = showcaseFrame(doc, elapsedMs);
        staged.forEach(({ object, stage }) => { object.visible = stage <= shot.stage; });
        camera.position.set(...shot.position); camera.position.y += elevationMm / 1000;
        camera.lookAt(shot.focus[0], shot.focus[1] + elevationMm / 1000, shot.focus[2]);
        camera.fov = shot.fov; camera.updateProjectionMatrix();
      } else {
        if (mode === 'showcase' && elapsedMs - 1000 / fps < introMs) {
          staged.forEach(({ object }) => { object.visible = true; });
          camera.fov = 75; camera.updateProjectionMatrix();
        }
        applyWalkPose(camera, compiled.samplePose(elapsedMs - introMs), elevationMm);
      }
      scene.updateMatrixWorld(true); gl.render(scene, camera);
      videoContext.drawImage(gl.domElement, 0, 0, width, height);
      await source.add(frame / fps, 1 / fps, { keyFrame: frame % (fps * 2) === 0 });
      if (frame % 10 === 0) { progress(frame / frames); await new Promise<void>((resolve) => setTimeout(resolve, 0)); }
    }
    await output.finalize(); progress(1);
    return new Blob([output.target.buffer!], { type: 'video/mp4' });
  } catch (error) { if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel(); throw error; }
  finally {
    staged.forEach(({ object, visible }) => { object.visible = visible; });
    restoreLighting();
    gl.setPixelRatio(dpr); gl.setSize(size.x, size.y, false); camera.aspect = aspect; camera.fov = fov; camera.updateProjectionMatrix();
    camera.position.copy(position); camera.quaternion.copy(quaternion);
    if (orbit) { orbit.enabled = enabled!; if (target) orbit.target.copy(target); orbit.update(); }
    root.invalidate();
  }
}
