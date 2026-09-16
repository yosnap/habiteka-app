import type { ChatVisionAdapter, Estilo, JsonSchema, MessagePart } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import { editorDesignContext } from '@/lib/editor-document/design-context';
import { getFurnitureCatalogEntry, FURNITURE_CATALOG } from '@/lib/editor-document/furniture-catalog';
import { SURFACE_MATERIALS } from '@/lib/editor-document/surface-materials';
import type { EditorDocument, FloorFinish } from '@/lib/editor-document/schema';
import { canPlaceNativeDesignFurniture, type NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { renderDesignOptionsSchema, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { allowedProposalCatalog, allowedProposalFurniture } from '@/lib/editor-document/proposal-permissions';

const MATERIAL_IDS = new Set(SURFACE_MATERIALS.map((material) => material.id));
const FLOOR_TEXTURES = new Set<string>(['none', 'wood', 'tile', ...MATERIAL_IDS]);

export const NATIVE_DESIGN_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['summary', 'materials', 'furniture'],
  properties: {
    summary: { type: 'string' },
    materials: { type: 'object', additionalProperties: false, required: ['walls', 'floors', 'stairs', 'ramps', 'columns'], properties: {
      walls: { type: 'string' }, floors: { type: 'string' }, stairs: { type: 'string' }, ramps: { type: 'string' }, columns: { type: 'string' },
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
  const result = await chat.chat({ model: '', responseSchema: NATIVE_DESIGN_SCHEMA, temperature: 0.2, maxTokens: 2400,
    messages: [{ role: 'user', content: [{ type: 'text', text: nativeDesignPrompt(document, style, objective, instruction, options) }, ...references] }],
  });
  return parseNativeDesignProposal(result.structured, style, document, options);
}

function nativeDesignPrompt(document: EditorDocument, style: Estilo, objective: string, instruction: string, options: RenderDesignOptions) {
  const materials = SURFACE_MATERIALS.map((item) => `${item.id} (${item.label}, ${item.category})`).join(', ');
  const furniture = FURNITURE_CATALOG.filter(item => allowedProposalCatalog(item, options)).map((item) => `${item.id} (${item.label}; ${item.widthMm}x${item.depthMm}mm)`).join(', ');
  return [
    `Eres interiorista y paisajista. Diseña el espacio con estilo ${estiloLabel(style)}.`,
    objective ? `Objetivo: ${objective}.` : '', instruction ? `Preferencia del cliente: ${instruction}.` : '',
    'Las imágenes adjuntas son planta y vistas estructurales de referencia. NO las reconstruyas ni propongas cambios físicos.',
    'No puedes añadir, quitar, mover, redimensionar, ocultar o cambiar la altura de muros, huecos, pisos, columnas, rampas, descansillos o escaleras.',
    'Tu JSON solo puede escoger acabados existentes y hasta 4 muebles/decoración del catálogo. Las coordenadas xMm/yMm son la esquina superior izquierda y deben caer completamente dentro de una habitación cerrada, nunca sobre rampas, escaleras o circulación.',
    `Permisos obligatorios, prevalecen sobre cualquier preferencia: ${JSON.stringify({ freedom: options.freedom, additions: options.additions, placement: options.placement, regions: options.regions })}.`,
    options.freedom === 'strict' ? 'Modo estricto: furniture debe ser []. Solo propone acabados, sin añadir objetos.' : 'Solo añade objetos del catálogo permitido; en zonas seleccionadas toda su huella debe quedar dentro de una zona. No muevas objetos existentes.',
    'La iluminación y los ángulos son ajustes para imágenes, no cambios editables. Resume solo cambios que realmente propones.',
    `Materiales permitidos: ${materials}.`,
    'Suelo permitido: none, wood, tile, o cualquiera de los materiales permitidos.',
    `Catálogo permitido: ${furniture}.`,
    'Contexto físico autoritativo:', JSON.stringify(editorDesignContext(document)),
  ].filter(Boolean).join('\n');
}

export function parseNativeDesignProposal(value: unknown, style: Estilo, document: EditorDocument, options: RenderDesignOptions): NativeDesignProposal {
  if (!value || typeof value !== 'object') throw new Error('La IA no devolvió una propuesta de diseño válida.');
  const input = value as Record<string, unknown>;
  const materials = input.materials as Record<string, unknown> | undefined;
  if (!materials) throw new Error('La IA no devolvió acabados válidos.');
  const material = (key: string, fallback: string) => typeof materials[key] === 'string' && MATERIAL_IDS.has(materials[key] as string) ? materials[key] as string : fallback;
  const floor = typeof materials.floors === 'string' && FLOOR_TEXTURES.has(materials.floors) ? materials.floors as FloorFinish['texture'] : 'none';
  const furniture = Array.isArray(input.furniture)
    ? input.furniture.flatMap((raw) => parseFurniture(raw)).filter((item) => allowedProposalFurniture(item, options) && canPlaceNativeDesignFurniture(document, item)).slice(0, 4)
    : [];
  return { style, summary: typeof input.summary === 'string' ? input.summary.slice(0, 500) : 'Propuesta de acabados y mobiliario.',
    materials: { walls: material('walls', 'plaster-white'), floors: floor, stairs: material('stairs', 'wood-oak'), ramps: material('ramps', 'concrete-grey'), columns: material('columns', 'concrete-grey') }, furniture };
}

function parseFurniture(value: unknown): NativeDesignProposal['furniture'] {
  if (!value || typeof value !== 'object') return [];
  const item = value as Record<string, unknown>, catalogId = typeof item.catalogId === 'string' ? item.catalogId : '';
  if (!getFurnitureCatalogEntry(catalogId) || !['xMm', 'yMm', 'rotation'].every((key) => typeof item[key] === 'number' && Number.isFinite(item[key]))) return [];
  return [{ catalogId, xMm: item.xMm as number, yMm: item.yMm as number, rotation: item.rotation as number, reason: typeof item.reason === 'string' ? item.reason.slice(0, 180) : '' }];
}
