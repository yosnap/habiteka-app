import type { ChatVisionAdapter } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';
import { assertRenderFraming } from './render-framing-check';
import sharp from 'sharp';
import { RenderRejectedError } from '@/server/errors/render-rejected-error';
import { renderViewVisibilityRule } from '@/lib/editor-document/render-view-visibility';
import { UserFacingError } from '@/server/errors/user-facing-error';
import { FURNITURE_USE_RULE } from '@/lib/editor-document/render-review';

type Image = { base64: string; mimeType: string };

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['accepted', 'cameraAndGeometryPreserved', 'objectIdentityPreserved', 'redesignApplied', 'violations'],
  properties: {
    accepted: { type: 'boolean' },
    cameraAndGeometryPreserved: { type: 'boolean' },
    objectIdentityPreserved: { type: 'boolean' },
    redesignApplied: { type: 'boolean' },
    violations: { type: 'array', items: { type: 'string' } },
  },
};

function isVerdict(value: unknown): value is {
  accepted: boolean; cameraAndGeometryPreserved: boolean; objectIdentityPreserved: boolean; redesignApplied?: boolean; violations: string[];
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
  drone?: { identity: Image; environment?: Image },
  redesignFixed = false,
  redesignRequested = redesignFixed,
): Promise<void> {
  await assertRenderFraming(capture, candidate);
  const [source, output, area] = await Promise.all([
    auditImage(capture), auditImage(candidate), mask ? auditImage(mask, true) : Promise.resolve(undefined),
  ]);
  const droneImages = drone ? await Promise.all([auditImage(drone.identity), ...(drone.environment ? [auditImage(drone.environment)] : [])]) : [];
  const result = await chat.chat({
    model: '', responseSchema: VERDICT_SCHEMA, temperature: 0,
    messages: [{ role: 'user', content: [
      { type: 'text', text: [
        `Audita la fidelidad de un diseño arquitectónico. Ángulo solicitado: ${view.preset}.`,
        'Imagen 1: captura original del 3D del proyecto. Imagen 2: diseño candidato.',
        ...(mask ? ['Imagen 3: máscara de la única zona diseñada (blanco = zona visible; negro = fondo gris claro vacío).'] : []),
        'Acepta mejoras de materiales, iluminación y realismo. La maqueta original puede tener muros cortados para ver el interior.',
        'Antes de declarar un bloque, plataforma u ocultación NUEVOS, comprueba si ya aparecen en la imagen 1 en la misma posición relativa y proporción. Un descansillo blanco o una superficie lisa ya modelados no son construcciones añadidas. Compara el inmueble tras alinear su encuadre: acercarlo dentro del lienzo no añade geometría. Solo atribuye al candidato las pérdidas u ocultaciones que introduce respecto de la captura; si cambia un descansillo, sus límites, peldaños o barandillas visibles, recházalo.',
        'Rechaza si cambia el punto de vista, orientación, silueta, número o posición de plantas, muros, huecos, escaleras, rampas, piscina o accesos visibles.',
        'Exige identidad completa: rechaza si desaparecen o se simplifican pérgolas, carpas, cubiertas, terrazas o cualquier elemento arquitectónico visible, aunque el volumen principal se parezca.',
        renderViewVisibilityRule(view),
        ...(drone ? ['La referencia adicional del inmueble es una vista cercana auditada del MISMO diseño. Compara la identidad y el volumen de la casa con esa vista, usando la cámara de la imagen 1. Rechaza pérdidas de elementos visibles en esa cámara y cualquier casa añadida.',
          ...(drone.environment ? ['La última imagen es la ortofoto real de la parcela. El entorno solo puede proceder de ella: conserva sus límites, caminos y vegetación sin inventar urbanización. La ortofoto no define el diseño de la casa.'] : ['La casa está aislada: conserva el fondo neutro sin paisaje.'])] : []),
        'Rechaza si sustituye el inmueble por otra casa, extiende la maqueta fuera de sus bordes, inserta una imagen del 3D dentro de otra escena, o produce un collage, superposición o doble arquitectura.',
        'Los muebles móviles pueden sustituirse: sofás, mesas, sillas, lámparas, alfombras y cortinas. Rechaza si bloquean accesos, cambian el uso del espacio o se añaden construcciones.',
        `Rechaza cualquier cambio de función del mobiliario. ${FURNITURE_USE_RULE}`,
        redesignRequested
          ? 'El usuario pidió REDISEÑO REAL: redesignApplied solo es true si los elementos modificables visibles muestran cambios reconocibles de formas, mobiliario, estilo o acabados. Una copia de los mismos elementos con mejor luz o textura NO es un rediseño: recházala. Si esta cámara no muestra ningún elemento modificable, no penalices esa ausencia. Los tabiques y la distribución nunca se rediseñan en este modo.'
          : 'No se exige rediseño en esta solicitud; indica redesignApplied=true.',
        redesignFixed
          ? 'El usuario autorizó REDISEÑO DE FIJOS: admite sustituciones y acabados nuevos de cocina, isla, sanitarios y armarios empotrados dentro del ámbito permitido. No los marques como pérdida de identidad de objetos; muros, huecos, instalaciones, usos y accesos siguen protegidos.'
          : 'FIJOS PROTEGIDOS: rechaza sustituciones o cambios de forma, ubicación o acabados de cocina, isla, sanitarios y armarios empotrados. Si hay cocina en L, rechaza huecos nuevos entre tramos; conserva el color dominante de cada encimera y los frentes; un tramo beige convertido en blanco puro o marrón oscuro no es una mejora de textura.',
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
      ...droneImages.map((image) => ({ type: 'image_url' as const, base64: image.base64, mimeType: image.mimeType })),
    ] }],
  });
  const verdict = result.structured;
  if (!isVerdict(verdict)) throw new UserFacingError('No se pudo verificar la fidelidad de la imagen. Se ha detenido el lote; vuelve a intentarlo.');
  if (!verdict.accepted || !verdict.cameraAndGeometryPreserved
      || !verdict.objectIdentityPreserved || (redesignRequested && verdict.redesignApplied !== true) || verdict.violations.length) {
    const detail = isVerdict(verdict) ? [
      ...(!verdict.cameraAndGeometryPreserved ? ['cámara o geometría alterada'] : []),
      ...(!verdict.objectIdentityPreserved ? ['objetos reconocibles sustituidos'] : []),
      ...(redesignRequested && verdict.redesignApplied !== true ? ['no se aplicó el rediseño solicitado'] : []),
      ...verdict.violations,
    ].slice(0, 3).join('; ').slice(0, 300) : '';
    throw new RenderRejectedError(`Se descartó el diseño porque no respeta la vista 3D${detail ? `: ${detail}` : '.'}`);
  }
}
