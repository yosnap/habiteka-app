import type { ChatVisionAdapter } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';
import { assertRenderFraming } from './render-framing-check';
import sharp from 'sharp';

type Image = { base64: string; mimeType: string };

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['accepted', 'cameraAndGeometryPreserved', 'objectIdentityPreserved', 'violations'],
  properties: {
    accepted: { type: 'boolean' },
    cameraAndGeometryPreserved: { type: 'boolean' },
    objectIdentityPreserved: { type: 'boolean' },
    violations: { type: 'array', items: { type: 'string' } },
  },
};

function isVerdict(value: unknown): value is {
  accepted: boolean; cameraAndGeometryPreserved: boolean; objectIdentityPreserved: boolean; violations: string[];
} {
  return typeof value === 'object' && value !== null
    && typeof (value as { accepted?: unknown }).accepted === 'boolean'
    && typeof (value as { cameraAndGeometryPreserved?: unknown }).cameraAndGeometryPreserved === 'boolean'
    && typeof (value as { objectIdentityPreserved?: unknown }).objectIdentityPreserved === 'boolean'
    && Array.isArray((value as { violations?: unknown }).violations)
    && (value as { violations: unknown[] }).violations.every((item) => typeof item === 'string');
}

/** Las imágenes de 4K ralentizan mucho el juicio; 1600 px conservan objetos reconocibles. */
async function auditImage(image: Image, mask = false): Promise<Image> {
  const resized = sharp(Buffer.from(image.base64, 'base64'))
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
  const bytes = mask ? await resized.png().toBuffer() : await resized.jpeg({ quality: 82 }).toBuffer();
  return { base64: bytes.toString('base64'), mimeType: mask ? 'image/png' : 'image/jpeg' };
}

/** Contrasta una imagen candidata con la captura real antes de publicarla como diseño. */
export async function assertRenderFidelity(
  chat: ChatVisionAdapter,
  capture: Image,
  candidate: Image,
  view: RenderView,
  mask?: Image,
  vehicleCount = 0,
  strictExterior = false,
): Promise<void> {
  await assertRenderFraming(capture, candidate);
  const [source, output, area] = await Promise.all([
    auditImage(capture), auditImage(candidate), mask ? auditImage(mask, true) : Promise.resolve(undefined),
  ]);
  const result = await chat.chat({
    model: '', responseSchema: VERDICT_SCHEMA, temperature: 0,
    messages: [{ role: 'user', content: [
      { type: 'text', text: [
        `Audita la fidelidad de un diseño arquitectónico. Ángulo solicitado: ${view.preset}.`,
        'Imagen 1: captura original del 3D del proyecto. Imagen 2: diseño candidato.',
        ...(mask ? ['Imagen 3: máscara de la única zona diseñada (blanco = zona visible; negro = fondo gris claro vacío).'] : []),
        'Acepta mejoras de materiales, iluminación y realismo. La maqueta original puede tener muros cortados para ver el interior.',
        'Rechaza si cambia el punto de vista, orientación, silueta, número o posición de plantas, muros, huecos, escaleras, rampas, piscina o accesos visibles.',
        'Rechaza si sustituye el inmueble por otra casa, extiende la maqueta fuera de sus bordes, inserta una imagen del 3D dentro de otra escena, o produce un collage, superposición o doble arquitectura.',
        'Rechaza si desaparecen o se desplazan muebles grandes visibles o si se añaden construcciones.',
        'Si hay cocina en L, comprueba la continuidad de la esquina y rechaza huecos nuevos entre tramos. Conserva el color dominante de cada encimera y los frentes; un tramo beige convertido en blanco puro o marrón oscuro no es una mejora de textura.',
        'Compara también la IDENTIDAD de cada objeto exterior visible, no solo su posición. Una fila de vehículos transformada en sofás es un fallo grave aunque conserve el número y la ubicación.',
        ...(vehicleCount ? [`El plano contiene ${vehicleCount} coches. Si son visibles en la imagen 1, en la imagen 2 deben seguir siendo coches reconocibles; nunca sofás u otros muebles.`] : []),
        ...(strictExterior ? ['El usuario pidió fidelidad estricta. Si el fondo exterior de la captura es liso o neutro, NO es terreno modelado: rechaza si el candidato lo sustituye por suelo, desierto, césped, árboles, arbustos, horizonte, cielo, aparcamiento o caminos nuevos. Mejorar texturas sobre objetos ya visibles sí está permitido.'] : []),
        ...(mask ? ['Fuera del blanco debe quedar fondo gris claro vacío. Rechaza si aparecen otras zonas del inmueble, mobiliario, terreno o construcciones.'] : []),
        'Rechaza decoración absurda aunque esté permitida: objetos sobre placas de cocina, fregaderos o inodoros; plantas sobre sillas, camas o electrodomésticos; muebles flotando, atravesando muros o tapando puertas o ventanas.',
        'No penalices diferencias normales de textura o decoración permitida. Ante duda sobre geometría o cámara, rechaza.',
        'Responde explícitamente cameraAndGeometryPreserved y objectIdentityPreserved. accepted solo puede ser true si ambos son true y no hay violaciones.',
      ].join('\n') },
      { type: 'image_url', base64: source.base64, mimeType: source.mimeType },
      { type: 'image_url', base64: output.base64, mimeType: output.mimeType },
      ...(area ? [{ type: 'image_url' as const, base64: area.base64, mimeType: area.mimeType }] : []),
    ] }],
  });
  const verdict = result.structured;
  if (!isVerdict(verdict) || !verdict.accepted || !verdict.cameraAndGeometryPreserved
      || !verdict.objectIdentityPreserved || verdict.violations.length) {
    const detail = isVerdict(verdict) ? [
      ...(!verdict.cameraAndGeometryPreserved ? ['cámara o geometría alterada'] : []),
      ...(!verdict.objectIdentityPreserved ? ['objetos reconocibles sustituidos'] : []),
      ...verdict.violations,
    ].slice(0, 3).join('; ').slice(0, 300) : '';
    throw new Error(`Se descartó el diseño porque no respeta la vista 3D${detail ? `: ${detail}` : '.'}`);
  }
}
