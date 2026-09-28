import type { ChatVisionAdapter, Estilo, JsonSchema, MessagePart } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import { editorDesignContext } from '@/lib/editor-document/design-context';
import { getFurnitureCatalogEntry, FURNITURE_CATALOG } from '@/lib/editor-document/furniture-catalog';
import { SURFACE_MATERIALS } from '@/lib/editor-document/surface-materials';
import type { EditorDocument, FloorFinish } from '@/lib/editor-document/schema';
import { addSuggestedFurniture, canPlaceNativeDesignFurniture, type NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { renderDesignOptionsSchema, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { allowedProposalCatalog, allowedProposalFurniture } from '@/lib/editor-document/proposal-permissions';
import { assertCompatibleDesignStyle, designScopeRooms, designScopeStructureIds, designScopeZone, type DesignScope } from '@/lib/editor-document/design-scope';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { zoneDesignContext, zoneRoomOutline } from './zone-design-context';

const MATERIAL_IDS = new Set(SURFACE_MATERIALS.map((material) => material.id));
const FLOOR_TEXTURES = new Set<string>(['none', 'wood', 'tile', ...MATERIAL_IDS]);

export const NATIVE_DESIGN_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['summary', 'materials', 'furniture'],
  properties: {
    summary: { type: 'string' },
    materials: { type: 'object', additionalProperties: false, required: ['walls', 'floors', 'slabUndersides', 'stairBodies', 'rampBodies', 'landingBodies', 'stairs', 'ramps', 'columns'], properties: {
      walls: { type: 'string' }, floors: { type: 'string' }, slabUndersides: { type: 'string' }, stairBodies: { type: 'string' }, rampBodies: { type: 'string' }, landingBodies: { type: 'string' },
      stairs: { type: 'string' }, ramps: { type: 'string' }, columns: { type: 'string' },
    } },
    furniture: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['catalogId', 'xMm', 'yMm', 'rotation', 'reason'], properties: {
      catalogId: { type: 'string' }, xMm: { type: 'number' }, yMm: { type: 'number' }, rotation: { type: 'number' }, reason: { type: 'string' },
    } }, },
  },
};

export async function proposeNativeDesign(
  chat: ChatVisionAdapter, document: EditorDocument, style: Estilo, objective: string, instruction: string, references: MessagePart[],
  rawOptions?: RenderDesignOptions,
): Promise<NativeDesignProposal> {
  const options = renderDesignOptionsSchema.parse(rawOptions ?? {});
  const scope = scopeFromOptions(options);
  designScopeRooms(document, scope);
  designScopeStructureIds(document, scope);
  assertCompatibleDesignStyle(document, style, scope);
  const result = await chat.chat({ model: '', responseSchema: NATIVE_DESIGN_SCHEMA, temperature: 0.2, maxTokens: 2400,
    messages: [{ role: 'user', content: [{ type: 'text', text: nativeDesignPrompt(document, style, objective, instruction, options) }, ...references] }],
  });
  return parseNativeDesignProposal(result.structured, style, document, options);
}

function nativeDesignPrompt(document: EditorDocument, style: Estilo, objective: string, instruction: string, options: RenderDesignOptions) {
  const materials = SURFACE_MATERIALS.map((item) => `${item.id} (${item.label}, ${item.category})`).join(', ');
  const scope = scopeFromOptions(options);
  const targetRooms = designScopeRooms(document, scope);
  const zone = scope.kind === 'zone' ? designScopeZone(document, scope) : null;
  const indoorIds = new Set(eligibleCeilingRooms(document).map((room) => room.id));
  const exteriorOnly = targetRooms.every((room) => !indoorIds.has(room.id));
  const furniture = FURNITURE_CATALOG.filter((item) => allowedProposalCatalog(item, options)
    && (!exteriorOnly || item.room === 'exterior' || item.id === 'habiteka:outdoor:tira-led'))
    .map((item) => `${item.id} (${item.label}; ${item.widthMm}x${item.depthMm}mm)`).join(', ');
  return [
    `Eres interiorista y paisajista. Diseña el espacio con estilo ${estiloLabel(style)}.`,
    objective ? `Objetivo: ${objective}.` : '', instruction ? `Preferencia del cliente: ${instruction}.` : '',
    zone ? 'La única imagen adjunta muestra exclusivamente la zona elegida. El resto del inmueble se ha ocultado: no lo uses para esta propuesta.'
      : 'Las imágenes adjuntas son planta y vistas estructurales de referencia. NO las reconstruyas ni propongas cambios físicos.',
    'No puedes añadir, quitar, mover, redimensionar, ocultar o cambiar la altura de muros, huecos, pisos, columnas, rampas, descansillos o escaleras.',
    'Tu JSON solo puede escoger acabados existentes y hasta 4 objetos del catálogo, incluidos muebles y luminarias autorizadas. Copia exactamente el catalogId del catálogo permitido. xMm/yMm son la esquina superior izquierda en MILÍMETROS, no metros, y toda la huella debe caer dentro de una estancia seleccionada, nunca sobre rampas, escaleras o circulación. Puedes poner muebles bajo una carpa o pérgola existentes si evitas sus postes y otros muebles.',
    `Ámbito editable: ${JSON.stringify({ kind: scope.kind, roomIds: targetRooms.map((room) => room.id), structureIds: [...designScopeStructureIds(document, scope)], zone: zone ? { id: zone.id, name: zone.name, polygonMm: zone.polygon } : null })}. Los acabados y objetos fuera de este ámbito permanecen intactos. La existingMaterialPalette del contexto enumera materiales ya guardados en todas las plantas: reutilízalos cuando encajen con la superficie y el uso. Puedes añadir un material permitido si la zona lo requiere, sin reemplazar la paleta de las demás zonas.`,
    `Estancias elegidas para colocar objetos (coordenadas en milímetros): ${JSON.stringify(targetRooms.map((room) => ({ id: room.id,
      boundaryMm: (zone ? zoneRoomOutline(zone, room) : room.boundary).map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })) })))}.`,
    `Permisos obligatorios, prevalecen sobre cualquier preferencia: ${JSON.stringify({ freedom: options.freedom, additions: options.additions, placement: options.placement, regions: options.regions })}.`,
    options.freedom === 'strict' ? 'Modo estricto: furniture debe ser []. Solo propone acabados, sin añadir objetos.' : 'Solo añade objetos del catálogo permitido; en zonas seleccionadas toda su huella debe quedar dentro de una zona. No muevas objetos existentes. Si el cliente pide muebles o luces permitidos, incluye objetos válidos cuando quepan; no los menciones solo en el resumen.',
    zone ? `Diseña únicamente «${zone.name}». Toda la huella de cada objeto nuevo debe quedar dentro de su polígono. El acabado de suelo se aplicará solo a esa parte, sin alterar el suelo de las zonas vecinas. Un muro que cruce el límite no cambiará completo; conserva su material.` : '',
    'El ambiente de captura y los ángulos son ajustes para imágenes. Conserva los techos y luminarias existentes. Si se permite iluminación y se pide una luz exterior real, puedes añadir habiteka:outdoor:tira-led dentro de furniture: su luz es visible en la escena 3D. No inventes luminarias fuera del catálogo. Resume solo cambios que realmente propones.',
    `Materiales permitidos: ${materials}.`,
    'Suelo permitido: none, wood, tile, o cualquiera de los materiales permitidos.',
    'Para el canto y la cara inferior de terrazas o plataformas elevadas, usa materials.slabUndersides con un material permitido solo si se pide cambiarlos. Si no se pide, devuelve none para conservar el acabado existente. Solo afecta a forjados elevados dentro del ámbito editable.',
    'Para contrahuellas, laterales y cara inferior de escaleras, usa materials.stairBodies con un material permitido solo si se pide cambiarlos. Si no se pide, devuelve none para conservar el acabado existente. No cambia las huellas ni la geometría y respeta el ámbito editable.',
    'Para los laterales y la cara inferior de rampas inclinadas, usa materials.rampBodies con un material permitido solo si se pide cambiarlos. Si no se pide, devuelve none para conservar el acabado existente. No cambia su superficie transitable ni su pendiente y respeta el ámbito editable.',
    'Para los laterales y la cara inferior de descansillos independientes, usa materials.landingBodies con un material permitido solo si se pide cambiarlos. Si no se pide, devuelve none para conservar el acabado existente. No cambia su pavimento ni su geometría y respeta el ámbito editable.',
    `Catálogo permitido: ${furniture}.`,
    'Contexto físico autoritativo:', JSON.stringify(zone
      ? zoneDesignContext(document, zone, targetRooms) : editorDesignContext(document)),
  ].filter(Boolean).join('\n');
}

export function parseNativeDesignProposal(value: unknown, style: Estilo, document: EditorDocument, options: RenderDesignOptions): NativeDesignProposal {
  if (!value || typeof value !== 'object') throw new Error('La IA no devolvió una propuesta de diseño válida.');
  const input = value as Record<string, unknown>;
  const materials = input.materials as Record<string, unknown> | undefined;
  if (!materials) throw new Error('La IA no devolvió acabados válidos.');
  const material = (key: string, fallback: string) => typeof materials[key] === 'string' && MATERIAL_IDS.has(materials[key] as string) ? materials[key] as string : fallback;
  const floor = typeof materials.floors === 'string' && FLOOR_TEXTURES.has(materials.floors) ? materials.floors as FloorFinish['texture'] : 'none';
  const slabUndersides = typeof materials.slabUndersides === 'string' && MATERIAL_IDS.has(materials.slabUndersides)
    ? materials.slabUndersides as FloorFinish['undersideTexture'] : undefined;
  const stairBodies = typeof materials.stairBodies === 'string' && MATERIAL_IDS.has(materials.stairBodies)
    ? materials.stairBodies as FloorFinish['undersideTexture'] : undefined;
  const rampBodies = typeof materials.rampBodies === 'string' && MATERIAL_IDS.has(materials.rampBodies)
    ? materials.rampBodies as FloorFinish['undersideTexture'] : undefined;
  const landingBodies = typeof materials.landingBodies === 'string' && MATERIAL_IDS.has(materials.landingBodies)
    ? materials.landingBodies as FloorFinish['undersideTexture'] : undefined;
  const scope = scopeFromOptions(options);
  const zone = scope.kind === 'zone' ? designScopeZone(document, scope) : null;
  const allowedRooms = new Set(designScopeRooms(document, scope).map((room) => room.id));
  const candidateDoc = upgradeSpatialDocument(document);
  const rooms = deriveRooms(candidateDoc);
  const rawFurniture = Array.isArray(input.furniture) ? input.furniture : [];
  const furniture: NativeDesignProposal['furniture'] = [];
  for (const item of rawFurniture.flatMap((raw) => parseFurniture(raw))) {
    if (furniture.length >= 4) break;
    if (!allowedProposalFurniture(item, options, zone?.polygon) || !canPlaceNativeDesignFurniture(candidateDoc, item, rooms, allowedRooms, zone?.polygon)) continue;
    furniture.push(item);
    addSuggestedFurniture(candidateDoc, item, rooms, allowedRooms, zone?.polygon);
  }
  const discarded = rawFurniture.length - furniture.length;
  // El texto libre del modelo puede atribuir montajes o muebles que el plano no
  // representa. El resumen se construye a partir de la propuesta validada.
  const objectLabels = furniture.map((item) => getFurnitureCatalogEntry(item.catalogId)?.label ?? item.catalogId);
  const summary = [`Propuesta ${estiloLabel(style)}: revisa los acabados antes de aplicar.`,
    objectLabels.length ? `Objetos aplicables: ${objectLabels.join(', ')}.` : 'Sin objetos aplicables.',
    discarded ? `Se descartaron ${discarded} objeto(s) por catálogo, permisos o ubicación.` : ''].filter(Boolean).join(' ');
  return { style, summary,
    scope, sourceRevision: document.revision,
    materials: { walls: material('walls', 'plaster-white'), floors: floor, slabUndersides, stairBodies, rampBodies, landingBodies,
      stairs: material('stairs', 'wood-oak'), ramps: material('ramps', 'concrete-grey'), columns: material('columns', 'concrete-grey') }, furniture };
}

function scopeFromOptions(options: RenderDesignOptions): DesignScope {
  return { kind: options.designScope, roomIds: options.designScope === 'rooms' ? options.designRoomIds : [],
    structureIds: options.designScope === 'rooms' ? options.designStructureIds : [],
    zoneId: options.designScope === 'zone' ? options.designZoneId : undefined };
}

function parseFurniture(value: unknown): NativeDesignProposal['furniture'] {
  if (!value || typeof value !== 'object') return [];
  const item = value as Record<string, unknown>, catalogId = typeof item.catalogId === 'string' ? item.catalogId : '';
  if (!getFurnitureCatalogEntry(catalogId) || !['xMm', 'yMm', 'rotation'].every((key) => typeof item[key] === 'number' && Number.isFinite(item[key]))) return [];
  return [{ catalogId, xMm: item.xMm as number, yMm: item.yMm as number, rotation: item.rotation as number, reason: typeof item.reason === 'string' ? item.reason.slice(0, 180) : '' }];
}
