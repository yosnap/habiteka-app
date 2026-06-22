/**
 * SPIKE de medición (F-LUZ): ¿el render refleja la ILUMINACIÓN de las luces
 * colocadas (color/intensidad), o las ignora?
 *
 * Genera DOS renders del mismo salón:
 *   A) SIN luces (control)
 *   B) CON un foco cálido intenso colocado en una esquina
 * Comparar a ojo dice si el modelo nota la iluminación (temperatura, reflejos,
 * sombras) → decisión GO/NO-GO de "render con luces" antes de prometerlo en F-LUZ.
 *
 * Gasta créditos reales (OpenRouter). Ejecutar a propósito:
 *   set -a; . ./.env.local; set +a
 *   npx tsx tests/spikes/render-con-luces.spike.ts
 *
 * NO es un test de vitest (haría llamadas pagadas en CI). Es un script manual.
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { EXAMPLE_SALON } from '../../src/canvas/examples';
import { serializeDocToPrompt } from '../../src/canvas/serialize-doc-to-prompt';
import { NanoBananaImageProvider } from '../../src/server/ai/image/providers/nano-banana';
import { CATALOG_BY_KIND } from '../../src/canvas/catalog';
import { defaultLight } from '../../src/canvas/light';
import type { CanvasDoc, StructObj } from '../../src/canvas/types';

function fillFor(kind: StructObj['kind']): string {
  if (kind === 'wall') return '#333333';
  if (kind === 'window') return '#7db7e8';
  if (kind === 'door') return '#b07d4a';
  if (kind === 'foco') return '#ffd9a0';
  return '#cccccc';
}

function docToSvg(doc: CanvasDoc, width = 920, height = 600): string {
  const rects = doc.objects
    .map((o) => {
      const label = CATALOG_BY_KIND[o.kind]?.label ?? o.kind;
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      return `
        <g transform="rotate(${o.rotation} ${cx} ${cy})">
          <rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}"
                fill="${fillFor(o.kind)}" stroke="#000" stroke-width="1.5" opacity="0.85"/>
          <text x="${cx}" y="${cy}" font-size="13" fill="#000" text-anchor="middle"
                dominant-baseline="middle">${label}</text>
        </g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#ffffff"/>${rects}</svg>`;
}

async function docToPngBase64(doc: CanvasDoc): Promise<string> {
  return (await sharp(Buffer.from(docToSvg(doc))).png().toBuffer()).toString('base64');
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Falta OPENROUTER_API_KEY (carga .env.local antes de correr)');
  const provider = new NanoBananaImageProvider(apiKey);

  // A) salón sin luces (control).
  const sinLuces = EXAMPLE_SALON;
  // B) mismo salón + un foco cálido intenso en una esquina.
  const foco: StructObj = {
    id: 'foco-1',
    kind: 'foco',
    x: 620,
    y: 160,
    width: 40,
    height: 40,
    rotation: 0,
    light: { ...defaultLight(), color: '#ff8a3d', intensidad: 95 },
  };
  const conLuces: CanvasDoc = { ...EXAMPLE_SALON, objects: [...EXAMPLE_SALON.objects, foco] };

  for (const [tag, doc] of [
    ['sin-luces', sinLuces],
    ['con-luces', conLuces],
  ] as const) {
    const description = serializeDocToPrompt(doc);
    if (!description) throw new Error('El doc de ejemplo no produjo descripción.');
    const referenceBase64 = await docToPngBase64(doc);
    const prompt = `Render 3D conceptual fotorrealista, estilo nórdico luminoso.\n\n${description}`;
    console.log(`🎨 Generando "${tag}"…`);
    try {
      const result = await provider.generate({
        prompt,
        aspectRatio: '16:9',
        referenceImage: { base64: referenceBase64, mimeType: 'image/png' },
      });
      await saveResult(`out-luces-${tag}`, result.assetUrl);
    } catch (e) {
      console.log(`   ⚠️ "${tag}" falló: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log('\n✅ Listo. Compara a ojo:');
  console.log('   - tests/spikes/out-luces-sin-luces.png  (control, sin foco)');
  console.log('   - tests/spikes/out-luces-con-luces.png  (con foco cálido intenso)');
  console.log('\n¿El render CON luces nota la iluminación cálida (ambiente, reflejos)? → GO/NO-GO.');
}

async function saveResult(name: string, assetUrl: string) {
  const m = /^data:[^;]+;base64,(.*)$/.exec(assetUrl);
  if (!m?.[1]) {
    console.log(`   ${name}: no es data URL → ${assetUrl.slice(0, 80)}`);
    return;
  }
  await writeFile(`tests/spikes/${name}.png`, Buffer.from(m[1], 'base64'));
  console.log(`   guardado → tests/spikes/${name}.png`);
}

main().catch((e) => {
  console.error('SPIKE falló:', e);
  process.exit(1);
});
