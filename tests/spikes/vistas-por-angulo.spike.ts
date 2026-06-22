/**
 * SPIKE de medición (F2): ¿el modelo de imagen respeta las posiciones del plano
 * desde ángulos NO cenitales?
 *
 * Pregunta a responder con evidencia visual: pasando el MISMO plano (texto
 * estructurado + referenceImage cenital), ¿el render respeta la disposición de
 * los elementos cuando se le pide la cámara desde la puerta / panorámica / ojo de
 * pájaro, o solo funciona en cenital?
 *
 * Genera un render por cada ÁNGULO variando SOLO la instrucción de cámara del
 * prompt; el texto estructurado del plano y la imagen de referencia son idénticos.
 * Comparar a ojo dice, por ángulo, si la fidelidad se mantiene → decisión GO/NO-GO
 * por ángulo (gate del roadmap antes de implementar F2 completa).
 *
 * Gasta créditos reales. Elige el MODELO con IMAGE_MODEL (atajos: nano-banana | flux),
 * todos por OpenRouter con la misma OPENROUTER_API_KEY (sin clave nueva). Ambos
 * reciben la MISMA referenceImage → comparación honesta de "¿qué modelo respeta
 * mejor la cámara con la misma información?".
 * Ejecutar a propósito:
 *   set -a; . ./.env.local; set +a
 *   IMAGE_MODEL=nano-banana npx tsx tests/spikes/vistas-por-angulo.spike.ts
 *   IMAGE_MODEL=flux        npx tsx tests/spikes/vistas-por-angulo.spike.ts
 *
 * NO es un test de vitest (haría llamadas pagadas en CI). Es un script manual.
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { EXAMPLE_SALON } from '../../src/canvas/examples';
import { serializeDocToPrompt } from '../../src/canvas/serialize-doc-to-prompt';
import { NanoBananaImageProvider } from '../../src/server/ai/image/providers/nano-banana';
import { CATALOG_BY_KIND } from '../../src/canvas/catalog';
import type { CanvasDoc, StructObj } from '../../src/canvas/types';

// Atajos → slug de OpenRouter. Todos van por el mismo cliente (Chat Completions
// con modalities) y aceptan referenceImage. Solo modelos que la cuenta tiene
// disponibles (FLUX no está expuesto por API en esta cuenta → se prueban los
// alternativos más potentes: Gemini 3 Pro y GPT-image, familias distintas).
const MODELOS: Record<string, { slug: string; tag: string }> = {
  'nano-banana': { slug: 'google/gemini-2.5-flash-image', tag: 'nano-banana' },
  'gemini3-pro': { slug: 'google/gemini-3-pro-image', tag: 'gemini3-pro' },
  'gpt-image': { slug: 'openai/gpt-5-image', tag: 'gpt-image' },
};

/** Construye el provider OpenRouter con el modelo elegido por IMAGE_MODEL. */
function resolveModel(): { provider: NanoBananaImageProvider; tag: string } {
  const which = process.env.IMAGE_MODEL ?? 'nano-banana';
  const entry = MODELOS[which];
  if (!entry) {
    throw new Error(`IMAGE_MODEL desconocido: "${which}". Usa: ${Object.keys(MODELOS).join(' | ')}`);
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('Falta OPENROUTER_API_KEY en .env.local');
  return { provider: new NanoBananaImageProvider(key, undefined, entry.slug), tag: entry.tag };
}

// --- Ángulos a probar. La frase de cámara es lo ÚNICO que cambia entre renders. ---
// Es un prototipo: estas frases son candidatas a convertirse en el mapeo
// declarativo viewType→cámara del paso 4 de F2 si la fidelidad resulta aceptable.
const ANGULOS: Array<{ key: string; camara: string }> = [
  {
    key: 'cenital',
    camara: 'Vista cenital (en planta), mirando la sala perpendicularmente desde arriba.',
  },
  {
    key: 'desde-puerta',
    camara:
      'Vista en primera persona desde el umbral de la puerta, a la altura de los ojos (~1,6 m), mirando hacia el interior de la sala.',
  },
  {
    key: 'panoramica',
    camara:
      'Vista panorámica interior gran angular desde una esquina, a la altura de los ojos, abarcando la mayor parte de la sala.',
  },
  {
    key: 'ojo-de-pajaro',
    camara:
      'Vista en perspectiva de tres cuartos (ojo de pájaro), desde un ángulo elevado a ~45°, mostrando la sala en volumen.',
  },
];

// --- Rasterización del doc a PNG de referencia (vía SVG + sharp; sin Konva/DOM) ---
// Misma técnica que el spike de referenceImage (CRL-4): cada elemento es un
// rectángulo etiquetado, para que el modelo reciba la disposición como imagen.

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

/** Prompt del render para un ángulo: cámara + descripción estructurada del plano. */
function promptParaAngulo(camara: string, descripcionPlano: string): string {
  return [
    `Render 3D conceptual fotorrealista, estilo nórdico luminoso.`,
    `CÁMARA: ${camara}`,
    '',
    descripcionPlano,
  ].join('\n');
}

async function main() {
  const { provider, tag } = resolveModel();

  const doc = EXAMPLE_SALON;
  // El MISMO texto estructurado de producción para todos los ángulos.
  const descripcionPlano = serializeDocToPrompt(doc);
  if (!descripcionPlano) throw new Error('El doc de ejemplo no produjo descripción (sin objetos).');

  console.log(`🧪 Modelo: ${tag}`);

  // Ambos modelos reciben la MISMA referencia rasterizada (comparación justa).
  const referenceBase64 = await docToPngBase64(doc);
  await writeFile('tests/spikes/out-vista-referencia.png', Buffer.from(referenceBase64, 'base64'));
  console.log('📐 Referencia del plano → tests/spikes/out-vista-referencia.png');
  const referenceImage = { base64: referenceBase64, mimeType: 'image/png' as const };

  console.log('\n--- Descripción estructurada (idéntica en todos los ángulos) ---\n');
  console.log(descripcionPlano + '\n');

  for (const { key, camara } of ANGULOS) {
    const prompt = promptParaAngulo(camara, descripcionPlano);
    console.log(`🎨 Generando vista "${key}"…`);
    try {
      const result = await provider.generate({ prompt, aspectRatio: '16:9', referenceImage });
      await saveResult(`out-vista-${tag}-${key}`, result.assetUrl);
    } catch (e) {
      console.log(`   ⚠️ "${key}" falló: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log('\n✅ Listo. Compara a ojo, por ángulo:');
  console.log('   - tests/spikes/out-vista-referencia.png  (disposición que dibujó el usuario)');
  for (const { key } of ANGULOS) {
    console.log(`   - tests/spikes/out-vista-${tag}-${key}.png`);
  }
  console.log('\nPara cada ángulo: ¿respeta posiciones/pared de cada elemento? → GO/NO-GO.');
  console.log('Vuelca el veredicto en docs/spikes/vistas-por-angulo/decision.md');
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
