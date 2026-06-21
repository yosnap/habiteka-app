/**
 * SPIKE de medición (F5): ¿la detección de elementos con POSICIÓN (bbox) sobre una
 * foto/plano es lo bastante precisa para poblar el plano sin grandes correcciones?
 *
 * Corre la detección de producción (`detectLayout`) sobre las imágenes de prueba
 * de `tests/spikes/inputs/` y vuelca lo detectado (kind + bbox normalizada). El
 * usuario evalúa a ojo cuántas detecciones son aceptables → métrica de salida de
 * beta (% aceptado). Funciona mejor con planos en planta; la perspectiva es el
 * experimento arriesgado (CRL-2).
 *
 * Gasta créditos reales (OpenRouter). Ejecutar a propósito:
 *   set -a; . ./.env.local; set +a
 *   npx tsx tests/spikes/deteccion-foto.spike.ts ruta/a/imagen.png [más imágenes...]
 *
 * NO es un test de vitest (haría llamadas pagadas en CI). Es un script manual.
 */
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { parseDetected, detectionPrompt } from '../../src/server/agent/phases/deteccion-layout';
import { OpenRouterChatVisionAdapter } from '../../src/server/ai/chat-vision-adapter';
import { DETECTED_SCHEMA } from '../../src/server/agent/phases/deteccion-layout';

// Modelo de visión para el spike (en producción lo resuelve el model-routing por
// acción 'vision'; aquí se fija explícitamente).
const VISION_MODEL = 'google/gemini-2.5-flash';

function mimeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('Falta OPENROUTER_API_KEY (carga .env.local antes de correr)');
  }

  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.log('Uso: npx tsx tests/spikes/deteccion-foto.spike.ts <imagen> [imagen...]');
    console.log('Pasa uno o más planos en planta / fotos para medir la detección.');
    return;
  }

  // Adaptador de visión real (OpenRouter). Toma OPENROUTER_API_KEY del entorno.
  const vision = new OpenRouterChatVisionAdapter();

  for (const path of paths) {
    const base64 = (await readFile(path)).toString('base64');
    console.log(`\n🔍 Detectando en ${path}…`);
    try {
      // Se replica `detectLayout` pero con un modelo de visión explícito (el spike
      // no pasa por el model-routing de producción).
      const result = await vision.chat({
        model: VISION_MODEL,
        messages: [
          { role: 'user', content: [{ type: 'text', text: detectionPrompt() }, { type: 'image_url', base64, mimeType: mimeFor(path) }] },
        ],
        responseSchema: DETECTED_SCHEMA,
      });
      const detected = parseDetected(result.structured);
      console.log(`   ${detected.length} elementos:`);
      for (const d of detected) {
        const { x, y, w, h } = d.bbox;
        const conf = d.confianza !== undefined ? ` conf=${d.confianza.toFixed(2)}` : '';
        console.log(
          `   - ${d.kind} @ (${x.toFixed(2)}, ${y.toFixed(2)}) ${w.toFixed(2)}×${h.toFixed(2)}${conf}`,
        );
      }
    } catch (e) {
      console.log(`   ⚠️ falló: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log('\n¿Qué % de las detecciones colocarías sin grandes correcciones? → métrica de beta.');
}

main().catch((e) => {
  console.error('SPIKE falló:', e);
  process.exit(1);
});
