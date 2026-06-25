/**
 * Arnés de calidad de imagen (F-S0).
 *
 * Dispara el proveedor ACTIVO (`IMAGE_PROVIDER`) sobre cada entrada de `inputs/`,
 * vuelca los resultados a `samples/<proveedor>/` y registra coste y latencia en
 * `run.json`. Para comparar los tres candidatos, se ejecuta una vez por proveedor
 * cambiando `IMAGE_PROVIDER`.
 *
 * Hace llamadas REALES: solo corre con `RUN_SPIKE=true` y las dev-keys puestas.
 * Sin esa variable, los tests se omiten (no se llama a IA en `bun test`/CI).
 */
import { describe, it, expect } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createActiveProvider } from '@/server/ai/image/provider-image-adapter';
import { loadCases, readInputImage, spikeEnabled, SAMPLES_DIR } from './spike-cases';

const provider = process.env.IMAGE_PROVIDER ?? 'flux';

interface RunEntry {
  id: string;
  op: 'generate';
  ms: number;
  costUsd: number;
  assetUrl: string;
}

describe.runIf(spikeEnabled())('arnés de calidad de imagen (llamadas reales)', () => {
  it(`genera una muestra por entrada con el proveedor "${provider}"`, async () => {
    const cases = await loadCases();
    expect(cases.length).toBeGreaterThan(0);

    const image = createActiveProvider();
    const outDir = join(SAMPLES_DIR, provider);
    await mkdir(outDir, { recursive: true });

    const results: RunEntry[] = [];
    for (const c of cases) {
      const ref = await readInputImage(c);
      const start = performance.now();
      const result = await image.generate({
        prompt: c.prompt,
        referenceImage: { base64: ref.toString('base64'), mimeType: 'image/jpeg' },
        aspectRatio: '1:1',
      });
      const ms = Math.round(performance.now() - start);
      results.push({
        id: c.id,
        op: 'generate',
        ms,
        costUsd: result.cost.amountUsd,
        assetUrl: result.assetUrl,
      });
    }

    // Cobertura completa del set: una muestra por entrada (criterio del plan).
    expect(results).toHaveLength(cases.length);

    await writeFile(
      join(outDir, 'run.json'),
      JSON.stringify({ provider, results }, null, 2),
      'utf8',
    );
  });
});
