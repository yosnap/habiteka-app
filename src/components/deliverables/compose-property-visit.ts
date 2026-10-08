/** Une los tramos IA revisados en orden, sin transiciones que oculten saltos. No admite imágenes ni capturas 3D. */
export async function composePropertyVisit(clips: { url: string; seconds: number }[], signal: AbortSignal, progress: (value: number) => void,
  refreshUrl?: (index: number) => Promise<string>) {
  const { Input, UrlSource, ALL_FORMATS, Output, BufferTarget, Mp4OutputFormat, CanvasSource, VideoSampleSink } = await import('mediabunny');
  if (!clips.length) throw new Error('No hay tramos revisados para componer.');
  const canvas = document.createElement('canvas'); canvas.width = 1366; canvas.height = 768;
  const context = canvas.getContext('2d'); if (!context) throw new Error('No se pudo preparar la composición.');
  const output = new Output({ target: new BufferTarget(), format: new Mp4OutputFormat() });
  const source = new CanvasSource(canvas, { codec: 'avc', bitrate: 4_000_000 });
  output.addVideoTrack(source, { frameRate: 24 });
  let offset = 0;
  try {
    await output.start();
    for (const [index, clip] of clips.entries()) {
      signal.throwIfAborted();
      const input = new Input({ source: new UrlSource(refreshUrl ? await refreshUrl(index) : clip.url), formats: ALL_FORMATS });
      try {
        const track = await input.getPrimaryVideoTrack();
        if (!track || !(await track.canDecode())) throw new Error(`No se puede decodificar el tramo ${index + 1}.`);
        const seconds = await track.computeDuration();
        if (!Number.isFinite(seconds) || Math.abs(seconds - clip.seconds) > .3)
          throw new Error(`La duración del tramo ${index + 1} no coincide con el paseo. Revisa ese resultado.`);
        const sink = new VideoSampleSink(track);
        let start: number | undefined, count = 0;
        for await (const sample of sink.samples()) {
          try {
            signal.throwIfAborted(); start ??= sample.timestamp;
            const local = sample.timestamp - start;
            if (local >= clip.seconds) continue;
            context.fillStyle = '#000'; context.fillRect(0, 0, canvas.width, canvas.height);
            const ratio = Math.min(canvas.width / sample.displayWidth, canvas.height / sample.displayHeight);
            sample.draw(context, (canvas.width - sample.displayWidth * ratio) / 2, (canvas.height - sample.displayHeight * ratio) / 2,
              sample.displayWidth * ratio, sample.displayHeight * ratio);
            await source.add(offset + local, Math.min(sample.duration || 1 / 24, clip.seconds - local)); count++;
          } finally { sample.close(); }
        }
        if (!count) throw new Error(`El tramo ${index + 1} está vacío.`);
        offset += clip.seconds;
        progress((index + 1) / clips.length);
      } finally { input.dispose(); }
    }
    source.close(); await output.finalize(); signal.throwIfAborted();
    const blob = new Blob([output.target.buffer!], { type: 'video/mp4' });
    if (blob.size > 1024 ** 3) throw new Error('El archivo supera 1 GB; reduce la resolución antes de exportar.');
    return { blob, durationMs: Math.round(offset * 1000) };
  } finally { if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel(); }
}
