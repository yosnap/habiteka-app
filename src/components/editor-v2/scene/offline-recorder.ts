import type { RootState } from '@react-three/fiber';
import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { WalkthroughPath } from '@/lib/editor-document/walkthrough';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { applyWalkPose } from './walk-camera';
import { showcaseFrame } from './showcase-timeline';
import { promotionFrame } from './promotion-timeline';
import { promotionVideoIssue, PROMOTION_DURATION_MS } from '@/lib/editor-document/promotion-video';
import { revealHiddenLighting } from './cutaway-wall';
import { nativeVideoNeedsRoute, nativeVideoDurationIssue, nativeVideoDurationMs, type NativeVideoMode } from '@/lib/editor-document/native-video';
import { constructionTiming } from '@/lib/editor-document/construction-timing';
import { prepareConstructionAnimation } from './construction-animation';
import { constructionAudioSamples, DEFAULT_VIDEO_PRESENTATION, type VideoPresentationOptions } from './construction-audio';
import { createVideoDimensionOverlay } from './video-dimension-overlay';
import { videoDimensionMode } from '@/lib/editor-document/video-presentation';
import { videoScopeRegions } from '@/lib/editor-document/video-content-scope';
import { isolateSceneToZone } from './zone-scene-isolation';
import { constructionFrame } from './construction-timeline';

/** Render frame a frame; la velocidad del equipo no cambia el tiempo del vídeo. */
export async function recordWalkthrough(root: RootState, doc: EditorDocument, route: WalkthroughPath | undefined,
  elevationMm: number, signal: AbortSignal, progress: (value: number) => void, mode: NativeVideoMode = 'walkthrough',
  presentation: VideoPresentationOptions = DEFAULT_VIDEO_PRESENTATION): Promise<Blob> {
  const compiled = nativeVideoNeedsRoute(mode) && route ? buildWalkthrough(doc, route) : null;
  if (nativeVideoNeedsRoute(mode) && !compiled) throw new Error('Selecciona un recorrido.');
  if (compiled?.invalidSegments.length) throw new Error('El recorrido cruza un obstáculo. Corrige los tramos marcados.');
  if (mode === 'promotion') {
    const issue = promotionVideoIssue(doc);
    if (issue) throw new Error(issue);
  }
  const introMs = mode === 'construction' || mode === 'showcase' ? constructionTiming(presentation).durationMs : mode === 'promotion' ? PROMOTION_DURATION_MS : 0;
  const durationMs = nativeVideoDurationMs(compiled?.durationMs ?? 0, mode, presentation);
  const durationIssue = nativeVideoDurationIssue(compiled?.durationMs ?? 0, mode, presentation);
  if (durationIssue) throw new Error(durationIssue);
  if ((mode === 'showcase' || mode === 'construction') && !doc.vertices.length) throw new Error('Dibuja el inmueble antes de crear el vídeo de construcción.');
  if (typeof VideoEncoder === 'undefined') throw new Error('Este navegador no permite exportar H.264. Usa un navegador con WebCodecs.');
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, canEncodeVideo, canEncodeAudio } = await import('mediabunny');
  const width = 1920, height = 1080, fps = 30;
  // Aumenta detalle sin exceder los límites de subida en piezas largas.
  const bitrate = durationMs <= 60000 ? 12_000_000 : 7_000_000;
  if (!await canEncodeVideo('avc', { width, height, bitrate })) throw new Error('H.264 a 1080p no está disponible en este navegador.');
  const withSound = mode !== 'walkthrough' && presentation.soundEffects;
  if (withSound && !await canEncodeAudio('aac', { sampleRate: 48000, numberOfChannels: 1, bitrate: 128000 }))
    throw new Error('AAC no está disponible. Desactiva los efectos de construcción o utiliza un navegador compatible.');
  const { gl, scene, camera } = root;
  if (!(camera instanceof PerspectiveCamera)) throw new Error('Cámara no compatible');
  // R3F puede reajustar el tamaño del canvas WebGL al viewport entre fotogramas.
  // El encoder recibe siempre un lienzo fijo para mantener el MP4 a 1080p.
  const videoCanvas = document.createElement('canvas');
  videoCanvas.width = width; videoCanvas.height = height;
  const videoContext = videoCanvas.getContext('2d');
  if (!videoContext) throw new Error('No se pudo preparar el lienzo del vídeo.');
  videoContext.imageSmoothingEnabled = true; videoContext.imageSmoothingQuality = 'high';
  const supersampling = gl.capabilities.maxTextureSize >= width * 2 ? 2 : 1;
  const renderWidth = width * supersampling, renderHeight = height * supersampling;
  const size = gl.getSize(new Vector2()), dpr = gl.getPixelRatio(), aspect = camera.aspect, fov = camera.fov;
  const position = camera.position.clone(), quaternion = camera.quaternion.clone();
  const orbit = root.controls as unknown as { enabled: boolean; target: Vector3; update: () => void } | null;
  const enabled = orbit?.enabled, target = orbit?.target.clone();
  const regions = videoScopeRegions(doc, presentation.contentScope ?? 'all');
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const restoreLighting = revealHiddenLighting(scene);
  let restoreScope: (() => void) | undefined;
  let animation: ReturnType<typeof prepareConstructionAnimation> | null = null;
  let dimensions: ReturnType<typeof createVideoDimensionOverlay> | null = null;
  try {
    restoreScope = regions.length ? isolateSceneToZone(scene, regions, true, Boolean(doc.geographicSite?.confirmed)) : undefined;
    animation = mode !== 'walkthrough' ? prepareConstructionAnimation(scene) : null;
    dimensions = videoDimensionMode(presentation) !== 'none' ? createVideoDimensionOverlay(scene, doc, camera, regions) : null;
    if (orbit) orbit.enabled = false;
    gl.setPixelRatio(1); gl.setSize(renderWidth, renderHeight, false); camera.aspect = width / height; camera.fov = 75; camera.updateProjectionMatrix();
    const source = new CanvasSource(videoCanvas, { codec: 'avc', bitrate });
    const audio = withSound ? new AudioBufferSource({ codec: 'aac', bitrate: 128000 }) : null;
    output.addVideoTrack(source, { frameRate: fps });
    if (audio) output.addAudioTrack(audio);
    await output.start();
    if (audio) {
      const samples = constructionAudioSamples(durationMs / 1000, mode === 'promotion', presentation.soundVolume, 48000,
        1, animation?.wallCount ?? 0, mode === 'construction' || mode === 'showcase', presentation);
      const buffer = new AudioBuffer({ numberOfChannels: 1, length: samples.length, sampleRate: 48000 });
      buffer.copyToChannel(samples, 0); await audio.add(buffer);
    }
    const frames = Math.ceil(durationMs / 1000 * fps);
    for (let frame = 0; frame < frames; frame++) {
      signal.throwIfAborted();
      if (gl.getContext().isContextLost()) throw new Error('Se interrumpió la vista 3D durante la exportación');
      if (gl.getPixelRatio() !== 1) gl.setPixelRatio(1);
      if (gl.domElement.width !== renderWidth || gl.domElement.height !== renderHeight) gl.setSize(renderWidth, renderHeight, false);
      const elapsedMs = frame / fps * 1000;
      if (elapsedMs < introMs) {
        const shot = mode === 'promotion' ? promotionFrame(doc, elapsedMs, regions)
          : mode === 'construction' ? constructionFrame(doc, elapsedMs, regions, presentation) : showcaseFrame(doc, elapsedMs, regions, presentation);
        animation?.apply(shot.stage, shot.stageProgress, mode === 'promotion');
        camera.position.set(...shot.position);
        camera.lookAt(...shot.focus);
        camera.fov = shot.fov; camera.updateProjectionMatrix();
      } else {
        if (mode === 'showcase' && elapsedMs - 1000 / fps < introMs) {
          animation?.apply(3, 1, false);
          camera.fov = 75; camera.updateProjectionMatrix();
        }
        if (compiled) applyWalkPose(camera, compiled.samplePose(elapsedMs - introMs), compiled.absoluteElevation ? 0 : elevationMm);
      }
      dimensions?.update(elapsedMs, presentation, height);
      scene.updateMatrixWorld(true); gl.render(scene, camera);
      videoContext.drawImage(gl.domElement, 0, 0, width, height);
      if (mode === 'promotion') {
        const shot = promotionFrame(doc, elapsedMs, regions);
        videoContext.fillStyle = '#142720d9'; videoContext.fillRect(0, height - 105, width, 105);
        videoContext.fillStyle = 'white'; videoContext.font = '28px sans-serif';
        videoContext.fillText(shot.label, 36, height - 60);
        videoContext.font = '20px sans-serif';
        videoContext.fillText('Visualización conceptual del diseño · entorno IGN / PNOA · no representa una obra ejecutada', 36, height - 25);
      }
      await source.add(frame / fps, 1 / fps, { keyFrame: frame % (fps * 2) === 0 });
      if (frame % 10 === 0) { progress(frame / frames); await new Promise<void>((resolve) => setTimeout(resolve, 0)); }
    }
    await output.finalize(); progress(1);
    return new Blob([output.target.buffer!], { type: 'video/mp4' });
  } catch (error) { if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel(); throw error; }
  finally {
    dimensions?.dispose();
    animation?.restore();
    restoreScope?.();
    restoreLighting();
    gl.setPixelRatio(dpr); gl.setSize(size.x, size.y, false); camera.aspect = aspect; camera.fov = fov; camera.updateProjectionMatrix();
    camera.position.copy(position); camera.quaternion.copy(quaternion);
    if (orbit) { orbit.enabled = enabled!; if (target) orbit.target.copy(target); orbit.update(); }
    root.invalidate();
  }
}
