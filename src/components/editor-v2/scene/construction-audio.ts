export { DEFAULT_VIDEO_PRESENTATION, type VideoPresentationOptions } from '@/lib/editor-document/video-presentation';
import { constructionTiming, type ConstructionTimingOptions } from '@/lib/editor-document/construction-timing';

/** Percusión y roces sintetizados localmente; sin música ni muestras de terceros. */
export function constructionAudioSamples(durationSeconds: number, promotion: boolean, volume: number, sampleRate = 48000, timelineScale = 1,
  wallCount = 0, constructionOnly = false, timingOptions: ConstructionTimingOptions = {}) {
  const samples = new Float32Array(Math.ceil(durationSeconds * sampleRate));
  const timing = constructionTiming(timingOptions);
  const start = constructionOnly ? timing.starts[0]! / 1000 : promotion ? 6 : 2 * timelineScale;
  const end = constructionOnly ? timing.ends[3]! / 1000 : promotion ? 25 : 11 * timelineScale;
  const wallStart = constructionOnly ? timing.starts[1]! / 1000 : promotion ? 10 : 4.5 * timelineScale;
  const wallEnd = constructionOnly ? timing.ends[1]! / 1000 : promotion ? 15 : 7.5 * timelineScale;
  const events: { time: number; rise: boolean; duration: number }[] = [];
  for (let time = start; time < Math.min(end, durationSeconds); time += .45) {
    if (wallCount && time >= wallStart && time < wallEnd) continue;
    events.push({ time, rise: false, duration: .13 });
  }
  for (let index = 0; index < wallCount; index++) {
    const interval = (wallEnd - wallStart) / wallCount;
    events.push({ time: wallStart + index * interval, rise: true, duration: Math.min(interval, .35) });
  }
  let random = 12345;
  for (let event = 0; event < events.length; event++) {
    const { time, rise, duration } = events[event]!;
    const first = Math.round(time * sampleRate);
    for (let i = 0; i < duration * sampleRate && first + i < samples.length; i++) {
      random = (1664525 * random + 1013904223) >>> 0;
      const t = i / sampleRate, noise = (random / 0xffffffff * 2 - 1);
      const impact = Math.sin(2 * Math.PI * (rise ? 110 : 340) * t) * Math.exp(-t * 45);
      const grit = noise * (rise ? Math.sin(Math.PI * t / duration) * .6 : Math.exp(-t * 70));
      samples[first + i]! += Math.max(0, Math.min(1, volume)) * (.32 * impact + .12 * grit);
    }
  }
  return samples;
}
