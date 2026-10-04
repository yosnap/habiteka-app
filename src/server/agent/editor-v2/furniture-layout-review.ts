import type { ChatVisionAdapter, JsonSchema } from '@/lib/contracts';
import type { EditorDocument, Furniture } from '@/lib/editor-document/schema';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { applyNativeDesignProposal, type NativeDesignFurniture, type NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { toModelFurniture } from '@/lib/editor-document/proposal-coordinates';
import { rasterizeEditorDocument } from './rasterize-editor-document';
import { furnitureFront, isBed, isSofa, PLAN_SIDE } from './furniture-views';

export interface FurnitureLayoutIssue { item: NativeDesignFurniture; problem: string }

const REVIEW_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['issues'],
  properties: { issues: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['item', 'problem'],
    properties: { item: { type: 'integer' }, problem: { type: 'string' } } } } },
};

function describe(item: NativeDesignFurniture, index: number): string {
  const entry = getFurnitureCatalogEntry(item.catalogId);
  const probe = { rotation: item.rotation, catalogId: item.catalogId, kind: entry?.kind ?? '' } as Furniture;
  const front = furnitureFront(probe), back = PLAN_SIDE({ x: -front.x, y: -front.y });
  const facing = isBed(probe) ? `, cabecero ${back}` : isSofa(probe) ? `, respaldo ${back}` : '';
  const { cxMm, cyMm } = toModelFurniture(item);
  return `${index + 1}. ${entry?.label ?? item.catalogId}: centro (${cxMm}, ${cyMm}) mm, giro ${Math.round(item.rotation)}°${facing}`;
}

/**
 * Jev revisa si la distribución propuesta es la de una vivienda real antes de enseñarla: la validación física solo
 * descarta lo imposible (solapes, fuera de la estancia), no una cama con el cabecero en mitad del cuarto o un sofá de
 * cara a la pared. Trabaja sobre la planta con la propuesta dibujada; si la revisión falla, la propuesta sigue sin ella.
 */
export async function reviewFurnitureLayout(chat: ChatVisionAdapter, document: EditorDocument,
  proposal: NativeDesignProposal): Promise<FurnitureLayoutIssue[]> {
  if (!proposal.furniture.length) return [];
  try {
    const plan = await rasterizeEditorDocument(applyNativeDesignProposal(document, proposal), undefined, { doorLeaves: true });
    const result = await chat.chat({
      model: '', responseSchema: REVIEW_SCHEMA, temperature: 0, maxTokens: 3000, reasoning: { effort: 'low' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: [
          'Eres Jev, revisor de distribuciones de interiorismo. La imagen es la planta del inmueble con una propuesta de muebles dibujada: muros oscuros, ventanas azules, puertas con su hoja y el arco de su giro, y muebles en beige; las camas llevan las almohadas en el lado del cabecero y los sofás el respaldo en gris. Arriba de la imagen es arriba en las posiciones.',
          `Muebles propuestos: ${proposal.furniture.map(describe).join('; ')}.`,
          ...(proposal.kitchens?.length ? [`La cocina se monta como mueble de cocina continuo (gris claro, con sus aparatos), ya validado: ${proposal.kitchens.length} tramo(s). No la señales; sí lo que estorbe delante de ella.`] : []),
          'Comprueba que cada uno sea realista en una vivienda: camas con el cabecero contra un muro, sin ventana baja detrás y con paso al menos por un lado; ningún mueble dentro del giro de una puerta ni tapando un paso; al menos 70 cm libres hacia puertas y entre muebles; sofás y butacas mirando a la zona de estar, no de cara a una pared cercana; mesas con sitio para sentarse; cada mueble en la estancia de su uso; nada en pasillos o recibidores salvo piezas estrechas.',
          'Devuelve solo problemas reales, con el número del mueble y una frase con la corrección concreta (girarlo, moverlo junto a qué muro o quitarlo). Si la distribución es correcta, devuelve issues vacío.',
        ].join('\n') },
        { type: 'image_url', base64: plan.base64, mimeType: 'image/png' },
      ] }],
    });
    const issues = (result.structured as { issues?: { item?: unknown; problem?: unknown }[] } | undefined)?.issues ?? [];
    return issues.flatMap(({ item, problem }) => {
      const target = typeof item === 'number' ? proposal.furniture[item - 1] : undefined;
      return target && typeof problem === 'string' && problem.trim() ? [{ item: target, problem: problem.trim().slice(0, 240) }] : [];
    });
  } catch {
    return [];
  }
}
