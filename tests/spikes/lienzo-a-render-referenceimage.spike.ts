/**
 * SPIKE de medición (CRL-4): ¿el modelo de imagen respeta el `referenceImage`?
 *
 * Pregunta a responder con evidencia visual: si le pasamos al render un PNG que
 * representa la disposición del lienzo (rectángulos = muebles, con su tipo), ¿el
 * render resultante respeta esa disposición, o ignora la referencia?
 *
 * Genera DOS renders del mismo doc de ejemplo del canvas:
 *   A) con texto estructurado + referenceImage (la vía propuesta para CRL-4)
 *   B) solo con texto estructurado (control, sin imagen de referencia)
 * Compararlos a ojo dice si la imagen de referencia aporta fidelidad.
 *
 * Gasta créditos reales (Gemini vía OpenRouter). Ejecutar a propósito:
 *   set -a; . ./.env.local; set +a; \
 *   npx tsx tests/spikes/lienzo-a-render-referenceimage.spike.ts
 *
 * NO es un test de vitest (haría llamadas pagadas en CI). Es un script manual.
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { EXAMPLE_SALON } from '../../src/canvas/examples';
import { NanoBananaImageProvider } from '../../src/server/ai/image/providers/nano-banana';
import { CATALOG_BY_KIND } from '../../src/canvas/catalog';
import type { CanvasDoc, StructObj } from '../../src/canvas/types';

// --- 1. Serializar el doc a texto estructurado (función pura, candidata a CRL-4) ---

/** Describe el lienzo como lista legible de elementos con tipo/posición/tamaño. */
function serializeDocToPrompt(doc: CanvasDoc): string {
  const lines = doc.objects.map((o) => {
    const label = CATALOG_BY_KIND[o.kind]?.label ?? o.kind;
    return `- ${label} en (${Math.round(o.x)}, ${Math.round(o.y)}), ${Math.round(o.width)}×${Math.round(o.height)}px${o.rotation ? `, rotado ${Math.round(o.rotation)}°` : ''}`;
  });
  return [
    'Distribución del espacio (vista en planta, coordenadas en píxeles):',
    ...lines,
    '',
    'Genera un render 3D fotorrealista de este espacio respetando ESTRICTAMENTE la',
    'posición y el tamaño relativo de cada elemento de la lista. Estilo nórdico, luminoso.',
  ].join('\n');
}

// --- 2. Rasterizar el doc a PNG (vía SVG + sharp; sin Konva/DOM) ---

/** Color de relleno por familia, para que cada tipo se distinga en la referencia. */
function fillFor(kind: StructObj['kind']): string {
  if (kind === 'wall') return '#333333';
  if (kind === 'window') return '#7db7e8';
  if (kind === 'door') return '#b07d4a';
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
  const svg = docToSvg(doc);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png.toString('base64');
}

// --- 3. Ejecutar y guardar evidencia ---

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Falta OPENROUTER_API_KEY (carga .env.local antes de correr)');

  const doc = EXAMPLE_SALON;
  const prompt = serializeDocToPrompt(doc);
  const referenceBase64 = await docToPngBase64(doc);

  // Guarda la referencia rasterizada para inspección.
  await writeFile('tests/spikes/out-referencia-lienzo.png', Buffer.from(referenceBase64, 'base64'));
  console.log('📐 Referencia del lienzo → tests/spikes/out-referencia-lienzo.png');
  console.log('\n--- Texto estructurado enviado al modelo ---\n' + prompt + '\n');

  // Sin storage: el provider devuelve el data URL base64 directamente.
  const provider = new NanoBananaImageProvider(apiKey);

  console.log('🎨 A) Generando CON referenceImage…');
  const withRef = await provider.generate({
    prompt,
    aspectRatio: '16:9',
    referenceImage: { base64: referenceBase64, mimeType: 'image/png' },
  });
  await saveResult('out-render-con-referencia', withRef.assetUrl);

  console.log('🎨 B) Generando SIN referenceImage (control)…');
  const noRef = await provider.generate({ prompt, aspectRatio: '16:9' });
  await saveResult('out-render-sin-referencia', noRef.assetUrl);

  console.log('\n✅ Listo. Compara a ojo:');
  console.log('   - tests/spikes/out-referencia-lienzo.png      (lo que dibujó el usuario)');
  console.log('   - tests/spikes/out-render-con-referencia.png  (A: con imagen de referencia)');
  console.log('   - tests/spikes/out-render-sin-referencia.png  (B: control, solo texto)');
  console.log('\n¿El render A respeta la disposición de la referencia mejor que B?');
}

/** El provider sin storage devuelve un data URL base64; lo vuelca a PNG. */
async function saveResult(name: string, assetUrl: string) {
  const m = /^data:[^;]+;base64,(.*)$/.exec(assetUrl);
  if (!m?.[1]) {
    console.log(`   ${name}: no es data URL (¿storage configurado?) → ${assetUrl.slice(0, 80)}`);
    return;
  }
  await writeFile(`tests/spikes/${name}.png`, Buffer.from(m[1], 'base64'));
  console.log(`   guardado → tests/spikes/${name}.png`);
}

main().catch((e) => {
  console.error('SPIKE falló:', e);
  process.exit(1);
});
