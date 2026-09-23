/**
 * Dependencias de IA y storage del feedback sobre un entregable, compartidas por
 * todos los llamadores (pestaña «Diseños» y endpoint de iteraciones) para que el
 * mismo cambio se comporte igual venga de donde venga.
 *
 * Los adaptadores se resuelven solo para el tipo de entregable que se itera: un
 * cambio en la memoria no exige un modelo de imagen configurado, y viceversa.
 */
import { getChatVisionAdapter, getImageAdapterForAction } from '@/server/ai';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { createDebitService } from '@/server/agent/debit-service-impl';
import { isNextIterationFree } from '@/server/billing/free-iterations';
import { PLAN_ZONE_SCHEMA } from '@/server/agent/phases/entrega';
import { isDrawablePlanZone } from '@/lib/contracts/plano2d-validation';
import { fail } from '@/server/errors/run-action';
import type { DebitService, ImageAdapter, InpaintRequest, PlanZone } from '@/lib/contracts';
import type { FeedbackDeps } from './feedback-orchestrator';

/** Coste reservado por iteración fuera del cupo gratuito. */
export const ITERATION_CREDITS = 500;

const STORED_DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/;

// Plano y memoria no generan imagen: no se exige un modelo de imagen configurado.
const NO_IMAGE: ImageAdapter = {
  generate: async () => fail('Este diseño no admite cambios de imagen.'),
  inpaint: async () => fail('Este diseño no admite cambios de imagen.'),
};

// Iteración dentro del cupo gratuito: no se reserva ni se cobra nada.
const FREE_DEBIT: DebitService = {
  hold: async (idempotencyKey) => ({ idempotencyKey, amount: 0 }),
  settle: async () => {},
  revert: async () => {},
};

/** Tipo de entregable tal como se guarda en BD (`RENDER_3D`, `PLANO_2D`, `MEMORIA`). */
export async function buildFeedbackDeps(
  organizationId: string,
  deliverable: { id: string; type: string },
): Promise<FeedbackDeps> {
  const org = { organizationId };
  const plano2d = deliverable.type === 'PLANO_2D' ? await getChatVisionAdapter(org, 'plano2d') : null;
  const memoria = deliverable.type === 'MEMORIA' ? await getChatVisionAdapter(org, 'memoria') : null;
  const free = await isNextIterationFree(deliverable.id);
  return {
    // Los retoques de imagen usan la sección «inpaint» del perfil de IA.
    image: deliverable.type === 'RENDER_3D' ? await getImageAdapterForAction(org, 'inpaint') : NO_IMAGE,
    debit: free ? FREE_DEBIT : createDebitService(organizationId),
    loadRenderBase,
    regenerateZone: async (change, _zoneId, current) => {
      if (!plano2d || !current) fail('Este diseño no tiene un plano que modificar.');
      const out = await plano2d.chat({
        model: '',
        temperature: 0,
        responseSchema: PLAN_ZONE_SCHEMA,
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: [
              'Modifica esta estancia de un plano 2D (coordenadas en milímetros) según el cambio pedido.',
              'Conserva el mismo id, el contorno y los muros que el cambio no afecte. Devuelve la estancia completa.',
              `CAMBIO: ${change}`,
              `ESTANCIA ACTUAL: ${JSON.stringify(current)}`,
            ].join('\n'),
          }],
        }],
      });
      if (!isDrawablePlanZone(out.structured)) {
        fail('La IA no devolvió un plano válido. Prueba a describir el cambio de otra forma.');
      }
      return { ...(out.structured as PlanZone), id: current.id };
    },
    reviseMemoria: async (markdown, change) => {
      if (!memoria) fail('Este diseño no es una memoria de materiales.');
      const out = await memoria.chat({
        model: '',
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: [
              'Eres un interiorista. Reescribe esta MEMORIA DE MATERIALES aplicando el cambio pedido.',
              'Mantén el formato markdown con encabezados por sección y conserva lo que el cambio no afecte.',
              `CAMBIO: ${change}`,
              '',
              markdown,
            ].join('\n'),
          }],
        }],
      });
      return out.content;
    },
  };
}

/** Bytes del render desde nuestro storage (la presignada guardada caduca). */
export async function loadRenderBase(payload: unknown): Promise<InpaintRequest['baseImage']> {
  const p = (payload ?? {}) as { assetKey?: unknown; assetUrl?: unknown };
  if (typeof p.assetKey === 'string' && p.assetKey) {
    const body = await getStorageAdapter().get(p.assetKey);
    return { base64: body.toString('base64'), mimeType: sniffImageMime(body) };
  }
  if (typeof p.assetUrl === 'string') {
    const data = STORED_DATA_URL.exec(p.assetUrl);
    if (data?.[1] && data[2]) return { base64: data[2], mimeType: data[1] };
  }
  const url = await resolveRenderUrl(p as { assetKey?: string; assetUrl?: string });
  if (!url) fail('El diseño no tiene una imagen recuperable.');
  return { url };
}

/** Tipo por la firma de los bytes: los renders pueden guardarse en PNG, JPEG o WebP. */
function sniffImageMime(bytes: Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'image/png';
}
