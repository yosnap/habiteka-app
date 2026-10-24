/**
 * TEMPORAL — generador de fotografías para el vídeo promocional v3 (presentacion-v3).
 * Usa el proveedor KIE configurado en la app (clave cifrada en BD) con el mismo
 * módulo que usa el producto para sus renders. Ejecución manual con coste.
 *
 * Uso: cd habiteka-app && bun run scripts/tmp-promo-fotos.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDecipheriv, createHash } from 'node:crypto';
import { prisma } from '../src/server/db/prisma';
import { KieImageProvider } from '../src/server/ai/image/providers/kie-image';

// Misma lógica que src/server/security/secret-box.ts (que exige runtime de servidor).
function openSecretLocal(value: string): string {
  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) throw new Error('Credencial cifrada inválida');
  const authSecret = process.env.BETTER_AUTH_SECRET;
  const developmentSeed = process.env.NODE_ENV === 'production' ? undefined : process.env.DATABASE_URL;
  if (!authSecret && !developmentSeed) throw new Error('Falta BETTER_AUTH_SECRET');
  const key = createHash('sha256').update(`habiteka:admin-secrets:v1:${authSecret ?? developmentSeed}`).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}

const DESTINO = join(process.cwd(), 'promo', 'presentacion-v3', 'fotos');
const MODELO = 'google/nano-banana';

// Estilo común: fotografía real, 16:9, luz cálida, película 35 mm — coherencia entre escenas.
const ESTILO =
  'Photorealistic cinematic still, wide 16:9 shot, warm natural light, 35mm film look, shallow depth of field, muted earthy palette, no text, no watermarks.';

const FOTOS = [
  {
    id: 'llamada',
    prompt:
      'A worried Spanish homeowner in his 40s sitting on a sofa in a bright modern living room, holding his phone to his ear in the middle of a call, thoughtful and uncertain expression, late afternoon sun through the window, some renovation brochures on the coffee table. ' + ESTILO,
  },
  {
    id: 'plano',
    prompt:
      'A wooden table covered with old floor plans, hand-drawn sketches, a tape measure, pencils and a coffee cup, nobody in the frame, warm window light from the side, slightly messy working surface. ' + ESTILO,
  },
  {
    id: 'arquitecto',
    prompt:
      'A homeowner and an architect in a serious meeting at a studio table, large blueprint drawings and small models between them, the homeowner leaning back looking uncertain, the architect pointing at the drawings, soft office light. ' + ESTILO,
  },
  {
    id: 'maqueta',
    prompt:
      'A small white architectural scale model of a modern house on a desk, a hand resting near it, the person looking at the model with an uncertain gaze, dramatic soft light from one side, the rest of the desk out of focus. ' + ESTILO,
  },
];

const credencial = await prisma.aiProviderCredential.findUnique({ where: { provider: 'kie' } });
if (!credencial?.enabled) throw new Error('KIE no está configurado o desactivado en la app');
const clave = openSecretLocal(credencial.encryptedApiKey);

const proveedor = new KieImageProvider(clave, undefined, MODELO);
mkdirSync(DESTINO, { recursive: true });

for (const foto of FOTOS) {
  console.log(`→ ${foto.id}…`);
  const resultado = await proveedor.generate({ prompt: foto.prompt, aspectRatio: '16:9' });
  const url = resultado.assetUrl;
  if (url.startsWith('data:')) {
    const base64 = url.slice(url.indexOf(',') + 1);
    writeFileSync(join(DESTINO, `${foto.id}.png`), Buffer.from(base64, 'base64'));
  } else {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`descarga de ${url} respondió ${r.status}`);
    const bytes = Buffer.from(await r.arrayBuffer());
    const ext = r.headers.get('content-type')?.includes('png') ? 'png' : 'jpg';
    writeFileSync(join(DESTINO, `${foto.id}.${ext}`), bytes);
  }
  console.log(`✓ ${foto.id} (${resultado.generation?.model ?? MODELO})`);
}
await prisma.$disconnect();
console.log(`\nFotografías en ${DESTINO}`);
