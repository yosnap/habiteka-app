import { describe, expect, it } from 'vitest';
import { videoGenerationPrompt } from '@/lib/editor-document/video-generation-prompt';
import { DEFAULT_VIDEO_PRESENTATION } from '@/lib/editor-document/video-presentation';

describe('guion portable de generación de vídeo', () => {
  it('combina ámbito, luz, identidad, secuencia y cotas con las instrucciones del usuario', () => {
    const prompt = videoGenerationPrompt('construction', 'warm', { ...DEFAULT_VIDEO_PRESENTATION, contentScope: 'house', dimensionMode: 'start', prompt: 'Vuelo final muy lento.' });
    expect(prompt).toContain('solo la casa'); expect(prompt).toContain('Atardecer'); expect(prompt).toContain('antes de empezar el siguiente');
    expect(prompt).toContain('muebles'); expect(prompt).toContain('Solo al inicio'); expect(prompt).toContain('No inventar ni dibujar cifras');
    expect(prompt).toContain('Vuelo final muy lento.'); expect(prompt).toContain('FX discretos');
    expect(prompt).toContain('8 segundos en total'); expect(prompt).toContain('3 segundos en conjunto');
  });
  it('incluye doce segundos con muebles y distingue el tiempo añadido de visita', () => {
    const prompt = videoGenerationPrompt('showcase', 'daylight', { ...DEFAULT_VIDEO_PRESENTATION, constructionDurationSeconds: 12 });
    expect(prompt).toContain('12 segundos, más la visita posterior');
    expect(prompt).toContain('muebles hasta 9 s');
  });
  it('no introduce construcción en la visita ni efectos cuando están desactivados', () => {
    const prompt = videoGenerationPrompt('walkthrough', 'daylight', { ...DEFAULT_VIDEO_PRESENTATION, soundEffects: false, showDimensions: false, contentScope: 'all' });
    expect(prompt).toContain('altura de ojos'); expect(prompt).not.toContain('Cada muro crece');
    expect(prompt).toContain('todo el plano'); expect(prompt).toContain('Sin medidas'); expect(prompt).toContain('sin efectos');
  });
});
