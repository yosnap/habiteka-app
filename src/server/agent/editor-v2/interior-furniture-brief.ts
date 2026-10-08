import { z } from 'zod';
import sharp from 'sharp';
import type { ChatVisionAdapter, JsonSchema } from '@/lib/contracts';
import type { RenderView } from '@/lib/editor-document/render-view';
import type { RenderSpatialContext } from './render-spatial-context';
import { UserFacingError } from '@/server/errors/user-facing-error';
import { renderAuditDetails } from './render-audit-details';

type Image = { base64: string; mimeType: string };
const schema = z.object({ located: z.boolean(), roomBox: z.object({
  left: z.number().min(0).max(1000), top: z.number().min(0).max(1000),
  right: z.number().min(0).max(1000), bottom: z.number().min(0).max(1000),
}).nullable(), connections: z.array(z.object({ openingId: z.string(), appearance: z.string() })), elements: z.array(z.object({
  name: z.string().trim().min(1), appearance: z.string().trim().min(1),
})).min(1).max(25) });

/** Lectura previa solo del diseño aceptado, sin mostrarle los muebles de la maqueta ni una candidata. */
export async function interiorFurnitureBrief(chat: ChatVisionAdapter, accepted: Image, view: RenderView, context: RenderSpatialContext): Promise<{ brief: string[]; detail?: Image }> {
  const details = await renderAuditDetails(accepted, 'top');
  const result = await chat.chat({ model: '', temperature: 0, maxTokens: 2400, reasoning: { effort: 'medium' },
    responseSchema: z.toJSONSchema(schema) as JsonSchema,
    messages: [{ role: 'user', content: [
      { type: 'text', text: [
        'Esta es la CENITAL ACEPTADA SIN GIRAR del inmueble. Lee exclusivamente su apariencia, sin proponer un rediseño.',
        `Localiza la estancia ${JSON.stringify(view.roomName)} y sus usos contiguos dentro del mismo recinto. El plano usa milímetros: ${JSON.stringify(context.levels.map(level => ({ rooms: level.rooms, openings: level.openings })))}`,
        'Los huecos incluyen connectsRooms con los usos a cada lado. Describe también el mobiliario del diseño aceptado que se pueda ver a través de esos huecos, nombrando su estancia; no atribuyas a un estudio la cama de un dormitorio vecino. No inventes visibilidad ni cambies el mobiliario para que quepa en cámara.',
        'Completa connections para cada hueco: openingId y apariencia del recinto AL OTRO LADO en la cenital aceptada. También para Recinto sin etiqueta, cuyo contorno boundary permite localizarlo: si es paso vacío, descríbelo así; no omitas esa conexión ni le asignes los muebles de una estancia vecina. No inventes una función cuando no se pueda identificar. Separa cada acceso aunque conecte con el mismo recinto.',
        'Describe cada grupo de muebles visible: forma, familia de color, material reconocible, cantidad y posición relativa. Incluye sillas (respaldo continuo o listones), taburetes (con o sin respaldo), mesa, cama, mesillas, sofás, textiles, cocina y suelos si los hay. No omitas sillas y taburetes por considerarlos detalles.',
        'Incluye fuentes, árboles y jardineras si existen: distingue una cubeta cuadrada de una fuente redonda y su altura visible sin inventar formas ocultas. roomBox es la caja ajustada de la estancia solicitada en la PRIMERA imagen completa, coordenadas 0–1000 (izquierda, arriba, derecha, abajo), nunca en las ampliaciones. Usa null si no puedes localizar su contorno con seguridad.',
        'No infieras altura ni porte de una planta desde una copa cenital; describe tamaño relativo de la copa, hojas, posición y jardinera visibles. connections describe la apariencia de la estancia conectada, no garantiza que cada objeto sea visible desde cada ventana o puerta.',
        'En sofás, camas y asientos separa tapicería principal, brazos/estructura y textiles decorativos. Crea entradas propias para cojines, mantas y colchas: cantidad visible, color de cada grupo y posición. Un sofá beige con cojines verdes no se describe simplemente como sofá beige. Anota si los brazos comparten el tapizado; no inventes brazos de cuero o madera ni paneles de otro color.',
        ...(details.length ? ['Las imágenes siguientes son ampliaciones de la misma referencia, en orden arriba izquierda, arriba derecha, abajo izquierda y abajo derecha. Se solapan: no dupliques objetos al contar.'] : []),
        'Cuenta sillas y taburetes uno a uno por lado de la mesa o barra. Indica el recuento por cada lado y la suma; no supongas un número habitual. Describe si cada asiento tiene respaldo y cómo es, examinando las ampliaciones.',
        'No adivines frentes o detalles verticales ocultos. No describas otra estancia como si fuera esta. Si no puedes localizarla con seguridad devuelve located=false. Conserva las diferencias entre los objetos. Máximo 35 palabras por grupo. No uses el plano para inventar su apariencia.',
      ].join('\n') },
      { type: 'image_url', ...accepted },
      ...details.map(image => ({ type: 'image_url' as const, ...image })),
    ] }],
  });
  const parsed = schema.safeParse(result.structured);
  if (!parsed.success || !parsed.data.located)
    throw new UserFacingError('No se pudo identificar esta estancia y su mobiliario en la cenital aceptada. Revisa la referencia antes de generar el interior.');
  const expected = new Set(context.levels.flatMap(level => level.openings.map(opening => opening.id)));
  const observed = parsed.data.connections.map(connection => connection.openingId);
  if (observed.length !== expected.size || new Set(observed).size !== expected.size || observed.some(id => !expected.has(id)))
    throw new UserFacingError('La lectura del diseño no identificó todas las conexiones de esta estancia. No se ha enviado una imagen al generador.');
  const brief = [...parsed.data.elements.map(item => `${item.name.slice(0, 100)}: ${item.appearance.slice(0, 500)}`),
    ...parsed.data.connections.map(item => `AL OTRO LADO DE ${item.openingId.slice(0, 100)}: ${item.appearance.slice(0, 500)}`)];
  const box = parsed.data.roomBox;
  if (!box || box.right - box.left < 30 || box.bottom - box.top < 30) return { brief };
  const bytes = Buffer.from(accepted.base64, 'base64'), { width = 0, height = 0 } = await sharp(bytes).metadata();
  if (!width || !height) return { brief };
  const left = Math.floor(Math.max(0, box.left - 15) * width / 1000), top = Math.floor(Math.max(0, box.top - 15) * height / 1000);
  const right = Math.ceil(Math.min(1000, box.right + 15) * width / 1000), bottom = Math.ceil(Math.min(1000, box.bottom + 15) * height / 1000);
  const detail = { mimeType: 'image/png', base64: (await sharp(bytes).extract({ left, top, width: right - left, height: bottom - top })
    .png().toBuffer()).toString('base64') };
  return { brief, detail };
}
