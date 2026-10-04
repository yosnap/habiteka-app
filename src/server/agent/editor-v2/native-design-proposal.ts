import type { ChatVisionAdapter, Estilo, JsonSchema, MessagePart } from '@/lib/contracts';
import { scopedDesignFixtures, validateFixedFinishes } from '@/lib/editor-document/fixed-design-finishes';
import { estiloDescripcion, estiloLabel } from '@/lib/design-options';
import { editorDesignContext } from '@/lib/editor-document/design-context';
import { getFurnitureCatalogEntry, FURNITURE_CATALOG } from '@/lib/editor-document/furniture-catalog';
import { SURFACE_MATERIALS } from '@/lib/editor-document/surface-materials';
import type { EditorDocument, FloorFinish, Point } from '@/lib/editor-document/schema';
import { addSuggestedFurniture, addSuggestedKitchens, doorClearZones, nativeFurniturePlacementIssue, settleNativeDesignFurniture, settleNativeDesignKitchen, type NativeDesignFurniture, type NativeDesignProposal, type NativeFurniturePlacementIssue } from '@/lib/editor-document/native-design-proposal';
import { faceAxis, fromModelFurniture, placeOnFace, PROPOSAL_ROTATIONS, toModelFurniture } from '@/lib/editor-document/proposal-coordinates';
import { isKitchenSlotKind, kitchenOnArm, planKitchen, type NativeDesignKitchen } from '@/lib/editor-document/native-design-kitchen';
import { KITCHEN_SLOT_DEFAULTS, KITCHEN_SLOT_KINDS } from '@/lib/editor-document/kitchen-run-types';
import { upgradeKitchenDocument } from '@/lib/editor-document/kitchen-run-commands';
import type { FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import type { SketchGuide } from './sketch-furniture-guide';
import { COMPANION_RULES } from '@/lib/editor-document/native-design-seating';
import { DEFAULT_WASHBASIN, isWetFixture, packWetRoom, WET_PACK_ORDERS, wetScore } from '@/lib/editor-document/native-design-wet-rooms';
import { roomInterior } from '@/lib/editor-document/room-interior';
import { roomWallFaces, type RoomWallFace } from '@/lib/editor-document/room-wall-faces';
import { renderDesignOptionsSchema, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { allowedProposalCatalog, allowedProposalFurniture } from '@/lib/editor-document/proposal-permissions';
import { assertCompatibleDesignStyle, designScopeRooms, designScopeStructureIds, designScopeZone, type DesignScope } from '@/lib/editor-document/design-scope';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { eligibleCeilingRooms } from '@/lib/editor-document/ceiling-geometry';
import { localToWorld, upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { zoneDesignContext, zoneRoomOutline } from './zone-design-context';
import { lightPlacementHints, plantPlacementHints, rugPlacementHints } from './native-design-placement-hints';
import { reviewFurnitureLayout, type FurnitureLayoutIssue } from './furniture-layout-review';

/**
 * Salida para amueblar una vivienda entera. Sin razonamiento: con `effort: 'low'` el modelo pensaba 16 000 tokens
 * comprobando cada solape al milímetro (y Sonnet 5 ignora un tope de razonamiento), así que el JSON se cortaba o no
 * llegaba. La parte exacta la resuelve el código: recoloca lo que queda a pocos centímetros de un sitio válido.
 */
const MAX_PROPOSAL_TOKENS = 16000;
const PROPOSAL_REASONING = { enabled: false } as const;
const MATERIAL_IDS = new Set(SURFACE_MATERIALS.map((material) => material.id));
const FLOOR_TEXTURES = new Set<string>(['none', 'wood', 'tile', ...MATERIAL_IDS]);

export const NATIVE_DESIGN_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['summary', 'materials', 'roomFinishes', 'kitchens', 'furniture', 'fixedFinishes'],
  properties: {
    summary: { type: 'string' },
    roomFinishes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['roomId', 'floor', 'walls'],
      properties: { roomId: { type: 'string' }, floor: { type: 'string' }, walls: { type: 'string' } } } },
    fixedFinishes: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['id', 'color'], properties: { id: { type: 'string' }, color: { type: 'string' },
        baseMaterialId: { type: 'string' }, worktopMaterialId: { type: 'string' },
        worktopColor: { type: 'string' }, uppersColor: { type: 'string' }, plinthColor: { type: 'string' } } } },
    materials: { type: 'object', additionalProperties: false, required: ['walls', 'exteriorWalls', 'floors', 'slabUndersides', 'stairBodies', 'rampBodies', 'landingBodies', 'stairs', 'ramps', 'columns'], properties: {
      walls: { type: 'string' }, exteriorWalls: { type: 'string' }, floors: { type: 'string' }, slabUndersides: { type: 'string' }, stairBodies: { type: 'string' }, rampBodies: { type: 'string' }, landingBodies: { type: 'string' },
      stairs: { type: 'string' }, ramps: { type: 'string' }, columns: { type: 'string' },
    } },
    kitchens: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['roomId', 'walls', 'appliances', 'uppers', 'frontColor', 'worktopMaterialId', 'reason'], properties: {
        roomId: { type: 'string' }, walls: { type: 'array', items: { type: 'string' } },
        appliances: { type: 'array', items: { type: 'string', enum: [...KITCHEN_SLOT_KINDS] } }, uppers: { type: 'boolean' },
        frontColor: { type: 'string' }, worktopMaterialId: { type: 'string' }, reason: { type: 'string' },
      } } },
    furniture: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['catalogId', 'wall', 'alongMm', 'cxMm', 'cyMm', 'rotation', 'reason'], properties: {
      catalogId: { type: 'string' }, wall: { type: 'string' }, alongMm: { type: 'number' },
      cxMm: { type: 'number' }, cyMm: { type: 'number' }, rotation: { type: 'number', enum: [...PROPOSAL_ROTATIONS] }, reason: { type: 'string' },
    } }, },
  },
};

export async function proposeNativeDesign(
  chat: ChatVisionAdapter, document: EditorDocument, style: Estilo, objective: string, instruction: string, references: MessagePart[],
  rawOptions?: RenderDesignOptions, guide: SketchGuide | null = null,
): Promise<NativeDesignProposal> {
  const options = renderDesignOptionsSchema.parse(rawOptions ?? {});
  const scope = scopeFromOptions(options);
  designScopeRooms(document, scope);
  designScopeStructureIds(document, scope);
  assertCompatibleDesignStyle(document, style, scope);
  const request = [{ role: 'user' as const, content: [{ type: 'text' as const, text: nativeDesignPrompt(document, style, objective, instruction, options, guide) },
    ...references, ...(guide ? [guide.image] : [])] }];
  const guided = guide !== null;
  const first = await chat.chat({ model: '', responseSchema: NATIVE_DESIGN_SCHEMA, temperature: 0.2, maxTokens: MAX_PROPOSAL_TOKENS,
    reasoning: PROPOSAL_REASONING, messages: request });
  const draft = parseNativeDesignProposalDetailed(first.structured, style, document, options, guided);
  if (options.freedom === 'strict') return draft.proposal;
  // El código protege lo físico y Jev juzga si la distribución es la de una vivienda real; la IA corrige una vez con ambos motivos.
  const layout = await reviewFurnitureLayout(chat, document, draft.proposal);
  if (!draft.rejections.length && !layout.length) return draft.proposal;
  // Las piezas válidas que Jev no señala se conservan tal cual: la corrección solo devuelve sustitutos. Pedir la vivienda
  // entera otra vez agotaba el límite de respuesta y se perdía todo lo que sí era válido.
  const flagged = new Set(layout.map(({ item }) => item));
  const kept = draft.proposal.furniture.filter((item) => !flagged.has(item)).map(toModelFurniture);
  try {
    const revised = await chat.chat({ model: '', responseSchema: NATIVE_DESIGN_SCHEMA, temperature: 0.2, maxTokens: MAX_PROPOSAL_TOKENS,
      reasoning: PROPOSAL_REASONING,
      messages: [...request,
        { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(first.structured) }] },
        { role: 'user', content: [{ type: 'text', text: correctionPrompt(draft.rejections, layout) }] }],
    });
    const raw = (revised.structured as { furniture?: unknown } | undefined)?.furniture;
    const replacements = Array.isArray(raw) ? raw : [];
    const merge = (furniture: unknown[]) => parseNativeDesignProposalDetailed({ ...(first.structured as object), furniture }, style, document, options, guided).proposal;
    const revisedProposal = merge([...kept, ...replacements]);
    const chosen = bestPerRoom(document, draft.proposal.furniture, revisedProposal.furniture);
    // Lo señalado que la corrección no sustituye por una pieza válida vuelve a su sitio, si aún cabe.
    const wanted = countBy(draft.proposal.furniture), placed = countBy(chosen);
    const missing = [...flagged].filter((item) => {
      const have = placed.get(item.catalogId) ?? 0;
      if (have >= (wanted.get(item.catalogId) ?? 0)) return false;
      placed.set(item.catalogId, have + 1);
      return true;
    });
    return chosen === revisedProposal.furniture && !missing.length ? revisedProposal : merge([...chosen, ...missing].map(toModelFurniture));
  } catch {
    // La corrección es un extra: si falla, la primera propuesta ya validada sigue siendo utilizable.
    return draft.proposal;
  }
}

/**
 * Piezas principales de una estancia: si la corrección pierde una de ellas (la cama, el sofá, la mesa, un sanitario o
 * un armario), esa estancia se queda como en la primera propuesta. Corregir el giro de un sofá no puede costar el sofá.
 */
const ANCHOR_PROFILES = new Set(['bed', 'sofa', 'sofa-chaise', 'sofa-corner', 'sofa-modular', 'sofa-bed', 'table', 'toilet', 'bath', 'shower', 'sink', 'cabinet']);
function bestPerRoom(document: EditorDocument, draft: NativeDesignFurniture[], revised: NativeDesignFurniture[]): NativeDesignFurniture[] {
  const rooms = deriveRooms(upgradeSpatialDocument(document));
  const roomOf = (item: NativeDesignFurniture) => rooms.find((room) => pointInPolygon(toModelCentre(item), room.boundary))?.id ?? '';
  const anchors = (items: NativeDesignFurniture[]) => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const profile = getFurnitureCatalogEntry(item.catalogId)?.profile ?? '';
      if (ANCHOR_PROFILES.has(profile)) counts.set(profile, (counts.get(profile) ?? 0) + 1);
    }
    return counts;
  };
  let reverted = false;
  const chosen = [...new Set([...draft, ...revised].map(roomOf))].flatMap((id) => {
    const before = draft.filter((item) => roomOf(item) === id), after = revised.filter((item) => roomOf(item) === id);
    const kept = anchors(after), lost = [...anchors(before)].some(([profile, count]) => (kept.get(profile) ?? 0) < count);
    reverted ||= lost;
    return lost ? before : after;
  });
  return reverted ? chosen : revised;
}

function countBy(furniture: NativeDesignFurniture[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { catalogId } of furniture) counts.set(catalogId, (counts.get(catalogId) ?? 0) + 1);
  return counts;
}

/**
 * Primero lo que ordena cada estancia, luego armarios y mesillas a su lado, después los asientos y al final la decoración.
 * En un baño, inodoro y lavabo antes que la bañera o la ducha: un aseo sin inodoro no es un aseo.
 */
const LATE_PROFILES: Readonly<Record<string, number>> = { bath: .5, shower: .5, cabinet: 1, shelf: 1, chair: 2, bench: 2, lamp: 3, plant: 3, decor: 3, curtain: 3, rug: 3, outdoor: 3 };
function placementOrder(raw: unknown): number {
  const id = (raw as { catalogId?: unknown } | null)?.catalogId;
  return LATE_PROFILES[typeof id === 'string' ? catalogEntryFor(id)?.profile ?? '' : ''] ?? 0;
}
/** Dentro de cada turno, lo grande antes: la bañera antes que el inodoro, que si no le quitaba la única pared larga. */
function footprintArea(raw: unknown): number {
  const id = (raw as { catalogId?: unknown } | null)?.catalogId, entry = typeof id === 'string' ? catalogEntryFor(id) : undefined;
  return entry ? entry.widthMm * entry.depthMm : 0;
}

function correctionPrompt(rejections: NativeDesignRejection[], layout: FurnitureLayoutIssue[] = []): string {
  const at = (item: NativeDesignFurniture) => { const placed = toModelFurniture(item);
    return `catalogId ${placed.catalogId}, cxMm ${placed.cxMm}, cyMm ${placed.cyMm}, rotation ${placed.rotation}`; };
  const list = rejections.map(({ text, item }) => `- ${text} (${at(item)})`).join('\n');
  return [...(rejections.length ? ['La validación física del plano rechazó estos objetos de tu propuesta:', list] : []),
    ...(layout.length ? ['La revisión de distribución (Jev) encontró estos problemas; corrígelos girando, moviendo o quitando esos objetos:',
      layout.map(({ problem, item }) => `- ${problem} (${at(item)})`).join('\n')] : []),
    'Devuelve el JSON con summary, materials y fixedFinishes iguales que antes, kitchens vacío (la cocina ya validada se conserva) y, en furniture, SOLO los objetos que sustituyen a los rechazados o señalados, colocados en otro sitio con sentido (respeta el motivo: no tapes accesos, ve junto a un borde, usa objetos del ambiente correcto). No repitas los objetos válidos: se conservan solos. Si un objeto no cabe en ningún sitio, no lo incluyas. No repitas coordenadas rechazadas ni inventes catalogId.'].join('\n');
}

function nativeDesignPrompt(document: EditorDocument, style: Estilo, objective: string, instruction: string, options: RenderDesignOptions, guide: SketchGuide | null = null) {
  const materials = SURFACE_MATERIALS.map((item) => `${item.id} (${item.label}, ${item.category})`).join(', ');
  const scope = scopeFromOptions(options);
  const targetRooms = designScopeRooms(document, scope);
  const zone = scope.kind === 'zone' ? designScopeZone(document, scope) : null;
  const doors = doorClearZones(document).map((box) => ({ minX: Math.round(box.minX), minY: Math.round(box.minY), maxX: Math.round(box.maxX), maxY: Math.round(box.maxY) }));
  const faces = proposalFaces(document, targetRooms, zone !== null);
  const indoorIds = new Set(eligibleCeilingRooms(document).map((room) => room.id));
  const exteriorOnly = targetRooms.every((room) => !indoorIds.has(room.id));
  const kitchensOn = arrangedByCode(options, zone !== null);
  const furniture = FURNITURE_CATALOG.filter((item) => allowedProposalCatalog(item, options)
    && (!exteriorOnly || item.room === 'exterior' || item.id === 'habiteka:outdoor:tira-led') && !(kitchensOn && looseKitchenPiece(item, guide !== null)))
    .map((item) => `${item.id} (${item.label}; ${item.widthMm}x${item.depthMm}mm)`).join(', ');
  return [
    `Eres interiorista y paisajista. Diseña el espacio con estilo ${estiloLabel(style)}: ${estiloDescripcion(style)} Elige cada suelo, pared, fachada y mueble para que se reconozca ese estilo, no acabados neutros o tradicionales.`,
    objective ? `Objetivo: ${objective}.` : '', instruction ? `Preferencia del cliente: ${instruction}.` : '',
    options.redesignFixed ? `Rediseño de acabados de fijos AUTORIZADO. fixedFinishes puede cambiar colores y materiales de estos objetos existentes: ${JSON.stringify(scopedDesignFixtures(document, scope).map((item) => ({ id: item.id, kind: item.kind, color: item.color, kitchen: 'kitchen' in item ? item.kitchen : undefined })))}. Conserva posición, tamaño, altura, módulos y aparatos. Para cocinas puedes usar baseMaterialId, worktopMaterialId, worktopColor, uppersColor y plinthColor. Para otros fijos solo color. Usa IDs existentes y materiales permitidos.` : 'Conserva todos los acabados de los fijos existentes; fixedFinishes debe ser [].',
    zone ? 'La única imagen adjunta muestra exclusivamente la zona elegida. El resto del inmueble se ha ocultado: no lo uses para esta propuesta.'
      : 'La imagen adjunta es la planta del inmueble en vista cenital, con cada puerta y el arco de su giro. NO la reconstruyas ni propongas cambios físicos.',
    'No puedes añadir, quitar, mover, redimensionar, ocultar o cambiar la altura de muros, huecos, pisos, columnas, rampas, descansillos o escaleras.',
    `Tu JSON solo puede escoger acabados existentes y objetos del catálogo, incluidos muebles y luminarias autorizadas. Copia exactamente el catalogId del catálogo permitido. cxMm/cyMm son el CENTRO de la huella en MILÍMETROS, no metros, y toda la huella debe caer dentro del interior de una estancia seleccionada, nunca sobre rampas, escaleras o circulación. Deja 250 mm de separación respecto a los demás muebles y estructuras, salvo entre piezas que van juntas: módulos y electrodomésticos de cocina, sanitarios, armarios, mesillas y camas pueden tocarse sin solaparse, y las sillas y bancos tocan su mesa y entre sí. Puedes poner muebles bajo una carpa o pérgola existentes si evitas sus postes. Una lámpara de mesa o un objeto decorativo de hasta 60 cm de alto puede apoyarse sobre una mesilla, mesa, aparador, cómoda o encimera si toda su huella cabe en el tablero; nunca sobre camas, sofás, sillas ni armarios altos. Las plantas van en el suelo. Si una lámpara de pie no tiene espacio libre, elige una lámpara de mesa que quepa sobre un mueble.`,
    // Sin cupo de objetos: el diseño inicial amuebla la vivienda entera y Jev revisa después la distribución.
    'Eres tú quien diseña: amuebla y decora cada estancia elegida por completo, como una vivienda real lista para vivir, con todo lo que su uso necesita y quepa dejando los pasos libres —dormir, estar, comer, cocinar, asearse, guardar, vegetación e iluminación, según el espacio—. Repite un objeto solo cuando el uso lo pide, como las sillas de una mesa o las mesillas de cada cama. En la decoración varía las piezas del catálogo; si no hay variedad suficiente, pon menos decoración antes que la misma pieza en todas las estancias. La luz del día o de la noche la deciden después las imágenes: aquí solo colocas lámparas donde hagan falta. Que cada pieza tenga una razón de diseño (zonificar, dar luz, enmarcar un borde) de menos de 40 caracteres y un sitio con sentido; la validación física y la revisión de distribución te dirán si algo no cabe o no encaja. Coloca cada pieza donde la pondría un interiorista, arrimada a su muro y con la orientación correcta; no hace falta cuadrar cada solape al milímetro: el sistema la desplaza unos centímetros hasta un sitio válido.',
    `Ámbito editable: ${JSON.stringify({ kind: scope.kind, roomIds: targetRooms.map((room) => room.id), structureIds: [...designScopeStructureIds(document, scope)], zone: zone ? { id: zone.id, name: zone.name, polygonMm: zone.polygon } : null })}. Los acabados y objetos fuera de este ámbito permanecen intactos. La existingMaterialPalette del contexto enumera materiales ya guardados en todas las plantas: reutilízalos cuando encajen con la superficie y el uso. Puedes añadir un material permitido si la zona lo requiere, sin reemplazar la paleta de las demás zonas.`,
    PLACEMENT_RULE,
    ORIENTATION_RULE,
    `Estancias elegidas para colocar objetos (milímetros). interiorMm es el suelo útil, ya descontado el grueso de los muros. walls son sus paredes: side dice en qué lado de la estancia está, atMm su coordenada (y en arriba/abajo, x en izquierda/derecha), fromMm–toMm su tramo, free los tramos libres de puertas y pasos y windows dónde hay ventana. doorClearMm son los rectángulos que cada puerta o paso necesita libres; ningún mueble puede pisarlos; una alfombra sí, siempre fuera del arco de giro de la hoja: ${JSON.stringify(targetRooms.map((room) => {
      const interior = zone ? zoneRoomOutline(zone, room) : roomInterior(document, room);
      return { id: room.id, name: roomName(document, room), interiorMm: interior.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })),
        walls: (faces.byRoom.get(room.id) ?? []).map(({ id, side, atMm, fromMm, toMm, free, windows }) => ({ id, side, atMm, fromMm, toMm, free, windows })),
        doorClearMm: doors.filter((box) => overlapsBox(box, interior)) };
    }))}.`,
    'Sentido del diseño: en zonas exteriores usa solo objetos de la categoría Exterior; una lámpara de pie o una planta de interior no van al aire libre. No bloquees el paso a escaleras, rampas ni puertas: deja 1000 mm libres alrededor de escaleras y rampas y, delante de cada puerta y a ambos lados del muro, una franja de su ancho tan honda como su hoja más 20 cm. Coloca plantas, jardineras y lámparas junto a muros, barandillas o el borde de la zona, nunca en mitad del espacio libre. Si no hay un sitio con sentido, devuelve menos objetos o ninguno.',
    lightPlacementHints(document, targetRooms, zone?.polygon, options),
    plantPlacementHints(document, targetRooms, zone?.polygon, options),
    rugPlacementHints(document, targetRooms, zone?.polygon, options),
    `Permisos obligatorios, prevalecen sobre cualquier preferencia: ${JSON.stringify({ freedom: options.freedom, additions: options.additions, placement: options.placement, regions: options.regions })}.`,
    ...(options.freedom === 'free' ? ['Equipa también baños, aseos, cocina y lavadero, contra los muros y agrupados como en una vivienda real: inodoro, lavabo y ducha o bañera en el baño; la cocina completa en kitchens; la lavadora en el lavadero. Pon la isla solo si queda 1 m libre alrededor. No tapes puertas ni ventanas.'] : []),
    kitchensOn ? KITCHEN_RULE : 'kitchens debe ser [].',
    guide && kitchensOn ? sketchRule(document, guide, targetRooms, faces) : '',
    options.freedom === 'strict' ? 'Modo estricto: furniture debe ser []. Solo propone acabados, sin añadir objetos.' : 'Solo añade objetos del catálogo permitido; en zonas seleccionadas toda su huella debe quedar dentro de una zona. No muevas objetos existentes. Si el cliente pide muebles o luces permitidos, incluye objetos válidos cuando quepan; no los menciones solo en el resumen.',
    zone ? `Diseña únicamente «${zone.name}». Toda la huella de cada objeto nuevo debe quedar dentro de su polígono. El acabado de suelo se aplicará solo a esa parte, sin alterar el suelo de las zonas vecinas. Un muro que cruce el límite no cambiará completo; conserva su material.` : '',
    'El ambiente de captura y los ángulos son ajustes para imágenes. Conserva los techos y luminarias existentes. Si se permite iluminación y se pide una luz exterior real, puedes añadir habiteka:outdoor:tira-led dentro de furniture: su luz es visible en la escena 3D. No inventes luminarias fuera del catálogo. Resume solo cambios que realmente propones.',
    // Un único material para toda la casa ponía el mismo suelo en el baño que en el dormitorio y la fachada igual que el salón.
    'Acabados por estancia: en roomFinishes da, para cada estancia elegida (su id), un suelo y un acabado de paredes según su uso. Baños, aseos, cocina y lavadero: suelo cerámico o de piedra y paredes cerámicas o de revestimiento resistente al agua. Dormitorios y salón: suelo de madera o parqué y paredes de revestimiento o pintura. Pasillos y entrada: el suelo de las estancias de día o uno cerámico. materials.exteriorWalls es la fachada (caras de los muros que dan al exterior): piedra, ladrillo, hormigón o revestimiento de exterior, nunca el acabado de un interior. materials.walls y materials.floors solo se usan en estancias sin entrada en roomFinishes.',
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
  return parseNativeDesignProposalDetailed(value, style, document, options).proposal;
}

/** Objeto que el modelo propuso y la validación rechazó, con el motivo, para pedirle una corrección. */
export interface NativeDesignRejection { text: string; item: NativeDesignFurniture }

export function parseNativeDesignProposalDetailed(value: unknown, style: Estilo, document: EditorDocument, options: RenderDesignOptions, guided = false):
  { proposal: NativeDesignProposal; rejections: NativeDesignRejection[] } {
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
  const candidateDoc = upgradeSpatialDocument(upgradeKitchenDocument(document));
  const rooms = deriveRooms(candidateDoc);
  // Primero lo que organiza cada estancia (camas, sofás, cocina, sanitarios, armarios, mesas), después sillas y bancos y
  // al final la decoración: si una planta se valida antes, la cama ya no cabe aunque el modelo la pensara primero.
  const rawFurniture = (Array.isArray(input.furniture) ? input.furniture : []).map((raw, index) => ({ raw, index }))
    .sort((a, b) => placementOrder(a.raw) - placementOrder(b.raw) || footprintArea(b.raw) - footprintArea(a.raw) || a.index - b.index).map(({ raw }) => raw);
  const furniture: NativeDesignProposal['furniture'] = [];
  const rejected: string[] = [], rejections: NativeDesignRejection[] = [];
  const reject = (text: string, item?: NativeDesignFurniture) => { rejected.push(text); if (item) rejections.push({ text, item }); };
  const faces = proposalFaces(document, designScopeRooms(document, scope), zone !== null), arranged = arrangedByCode(options, zone !== null);
  // La cocina primero: es lo que ordena su estancia, y lo demás se coloca alrededor.
  const kitchens: NativeDesignKitchen[] = [];
  if (arranged) for (const raw of (Array.isArray(input.kitchens) ? input.kitchens : []).slice(0, 2)) {
    const arms = parseKitchen(raw, document, rooms, faces, guided);
    if (!arms.length) { reject('Cocina: la estancia no tiene una pared libre de 1,2 m con paso delante'); continue; }
    for (const { kitchen, roomId } of arms) {
      const settled = settleNativeDesignKitchen(candidateDoc, kitchen, rooms, new Set([roomId]));
      if (settled.issue) { reject(`Cocina: ${placementIssueLabel(settled.issue)}`); continue; }
      kitchens.push(settled.kitchen);
      addSuggestedKitchens(candidateDoc, [settled.kitchen], rooms, allowedRooms);
    }
  }
  const roomAt = (point: Point) => rooms.find((room) => allowedRooms.has(room.id) && pointInPolygon(point, room.boundary))?.id;
  // Sillas, mesillas y mesa de centro las coloca el código junto a su mesa, cama o sofá, con el modelo que eligió la IA.
  const proposed = rawFurniture.flatMap((raw) => parseFurniture(raw, faces));
  const entryOf = (item: NativeDesignFurniture) => getFurnitureCatalogEntry(item.catalogId);
  const rules = COMPANION_RULES.filter((rule) => proposed.some(({ item }) => rule.anchor(entryOf(item))));
  const roomOf = ({ item, roomId }: { item: NativeDesignFurniture; roomId?: string }) => roomId ?? roomAt(toModelCentre(item));
  // Estancias con la pieza principal de cada conjunto: un acompañante de la IA solo se sustituye donde hay quien lo lleve.
  const anchored = rules.map((rule) => new Set(proposed.filter(({ item }) => rule.anchor(entryOf(item))).map(roomOf)));
  const choice = new Map<string, string>(), served = new Set<string>();
  for (const entry of proposed) {
    const room = roomOf(entry);
    rules.forEach((rule, index) => {
      if (room && rule.companion(entryOf(entry.item)) && !choice.has(`${index}:${room}`)) choice.set(`${index}:${room}`, entry.item.catalogId);
    });
  }
  // Sanitarios de cada baño: tal como los puso la IA si caben todos; si no, recolocados desde las esquinas.
  const handled = new Set<unknown>();
  if (arranged) for (const [roomId, list] of wetFixturesByRoom(rawFurniture, faces, roomAt)) {
    list.forEach(({ raw }) => handled.add(raw));
    const only = new Set([roomId]), mark = { doc: candidateDoc.furniture.length, list: furniture.length };
    const commit = (item: NativeDesignFurniture) => { furniture.push(item); addSuggestedFurniture(candidateDoc, item, rooms, allowedRooms, zone?.polygon); return item; };
    const undo = () => { candidateDoc.furniture.splice(mark.doc); furniture.splice(mark.list); };
    const asProposed = list.flatMap(({ item, along }) => {
      const result = settleNativeDesignFurniture(candidateDoc, item, rooms, only, zone?.polygon, along);
      return result.issue ? [] : [commit(result.item)];
    });
    const entries = list.map(({ item }) => getFurnitureCatalogEntry(item.catalogId)!);
    // Un inodoro siempre lleva un lavabo cerca, aunque la IA no lo pida.
    if (entries.some((entry) => entry.profile === 'toilet') && !entries.some((entry) => entry.profile === 'sink')) entries.push(getFurnitureCatalogEntry(DEFAULT_WASHBASIN)!);
    if (asProposed.length >= entries.length) continue;
    // Si no cabe todo, se prueba cada orden de colocación desde las esquinas y se queda el mejor baño.
    const attempts = [asProposed, ...WET_PACK_ORDERS.map((order) => {
      undo();
      return packWetRoom(entries, faces.byRoom.get(roomId) ?? [], SMALLER, (item, axis) => {
        const result = settleNativeDesignFurniture(candidateDoc, item, rooms, only, zone?.polygon, axis);
        return result.issue ? null : commit(result.item);
      }, order);
    })];
    const best = attempts.reduce((winner, attempt) => wetScore(attempt) > wetScore(winner) ? attempt : winner);
    undo();
    best.forEach(commit);
    if (best.length < entries.length) reject(`Sanitarios: caben ${best.length} de ${entries.length} en ${roomName(document, rooms.find((room) => room.id === roomId)!)}`);
  }
  for (const raw of rawFurniture) {
    if (handled.has(raw)) continue;
    const parsed = parseFurniture(raw, faces)[0];
    if (!parsed) { reject('objeto sin ficha o coordenadas válidas'); continue; }
    if (rules.some((rule, index) => rule.companion(entryOf(parsed.item)) && anchored[index]!.has(roomOf(parsed)))) continue;
    let { item, along } = parsed;
    // Al recolocarla, la pieza no sale de su estancia: la de su pared o la de su centro propuesto.
    const home = parsed.roomId ?? roomAt(toModelCentre(item));
    // Una planta o una lámpara de pie sin pared se arrima a la más cercana de su estancia, sin quedarse a medio metro.
    const nearest = arranged && !parsed.roomId && home && hugsWall(getFurnitureCatalogEntry(item.catalogId)) ? nearestFace(faces.byRoom.get(home) ?? [], toModelCentre(item)) : undefined;
    if (nearest) {
      const centre = toModelCentre(item), alongMm = nearest.side === 'arriba' || nearest.side === 'abajo' ? centre.x : centre.y;
      item = fromModelFurniture(placeOnFace({ ...toModelFurniture(item), alongMm }, nearest)) ?? item;
      along = faceAxis(nearest);
    }
    const settleRooms = home ? new Set([home]) : allowedRooms;
    let label = getFurnitureCatalogEntry(item.catalogId)!.label;
    let catalog = getFurnitureCatalogEntry(item.catalogId)!;
    if (!allowedProposalCatalog(catalog, options)) { reject(`${label}: categoría no permitida`, item); continue; }
    if (kitchens.length && looseKitchenPiece(catalog, guided)) { reject(`${label}: va encajado en el mueble de cocina`); continue; }
    // Un taburete sin isla ni barra se queda en mitad de la cocina.
    if (catalog.id.includes('taburete') && !furniture.some((other) => other.catalogId.includes('isla') && roomAt(toModelCentre(other)) === home)) {
      reject(`${label}: sin isla ni barra a la que arrimarse`); continue;
    }
    if (!allowedProposalFurniture(item, options, zone?.polygon)) {
      reject(`${label}: fuera de la zona de colocación permitida`, item); continue;
    }
    const fit = (candidate: NativeDesignFurniture, entry: FurnitureCatalogEntry, axis?: Point) => {
      const result = settleNativeDesignFurniture(candidateDoc, candidate, rooms, settleRooms, zone?.polygon, axis);
      // Una cama, un sofá, un armario o un sanitario que no cabe en la pared elegida prueba las demás de su estancia.
      return result.issue && arranged && home && WALL_PROFILES.has(entry.profile) ? otherWall(faces.byRoom.get(home) ?? [], (face) => settleNativeDesignFurniture(candidateDoc,
        fromModelFurniture(placeOnFace({ ...toModelFurniture(candidate), alongMm: undefined }, face))!, rooms, settleRooms, zone?.polygon, faceAxis(face)), entry.widthMm) ?? result : result;
    };
    const roomFaces = home ? faces.byRoom.get(home) ?? [] : [];
    // El mueble de la tele va en la pared de enfrente del sofá, centrado con él; si ahí no cabe, donde lo puso la IA.
    const sofa = arranged && /mueble[-_]tv/.test(catalog.id) ? furniture.find((other) => entryOf(other)?.profile.startsWith('sofa') && roomAt(toModelCentre(other)) === home) : undefined;
    const facing = sofa ? facingWall(roomFaces, sofa) : undefined;
    const tv = facing && settleNativeDesignFurniture(candidateDoc, fromModelFurniture(placeOnFace({ ...toModelFurniture(item), alongMm: facing.alongMm }, facing.face))!,
      rooms, settleRooms, zone?.polygon, faceAxis(facing.face));
    let settled = tv && !tv.issue ? tv : fit(item, catalog, along);
    // Si no cabe en ninguna pared, otra más pequeña del mismo uso: la ducha en lugar de la bañera.
    for (let smaller = arranged ? SMALLER[catalog.id] : undefined; settled.issue && smaller; smaller = SMALLER[smaller]) {
      const retry = parseFurniture({ ...(raw as object), catalogId: smaller }, faces)[0], entry = getFurnitureCatalogEntry(smaller);
      if (!retry || !entry) break;
      const result = fit(retry.item, entry, retry.along);
      if (!result.issue) { settled = result; catalog = entry; label = entry.label; }
    }
    if (settled.issue) { reject(`${label}: ${placementIssueLabel(settled.issue)}`, item); continue; }
    // Un cabecero bajo la ventana: la cama pasa a una pared ciega de su dormitorio donde quepa con al menos una mesilla.
    // Con boceto manda el cliente: si dibujó la cama bajo la ventana, ahí se queda.
    if (arranged && !guided && catalog.profile === 'bed' && underWindow(roomFaces, settled.item)) {
      const blind = otherWall(roomFaces.filter((face) => !face.windows.length), (face) => settleNativeDesignFurniture(candidateDoc,
        fromModelFurniture(placeOnFace({ ...toModelFurniture(settled.item), alongMm: undefined }, face))!, rooms, settleRooms, zone?.polygon, faceAxis(face)), catalog.widthMm + 450);
      if (blind) settled = blind;
    }
    // Contra una pared, se desliza a lo largo de la pared en la que ha quedado (puede no ser la que eligió la IA).
    if (arranged && WALL_PROFILES.has(catalog.profile) && wallBehind(roomFaces, settled.item)) along = settled.item.rotation % 180 ? { x: 0, y: 1 } : { x: 1, y: 0 };
    const groups = (anchor: NativeDesignFurniture) => rules.flatMap((rule, index) => {
      const key = rule.fallback ? `${index}:${home ?? ''}` : `${rule.name}:${home ?? ''}`;
      const chosen = choice.get(`${index}:${home ?? ''}`) ?? (rule.fallback && rule.anchor(catalog) ? rule.fallback(catalog) : undefined);
      return rule.anchor(catalog) && chosen && (rule.fallback || !served.has(key)) ? [{ rule, key, chosen, items: rule.place(anchor, chosen) }] : [];
    });
    // Contra una pared, la pieza se desliza por ella hasta dejar sitio a sus acompañantes (las dos mesillas de la cama);
    // exenta (una mesa), se aparta de la pared en cualquier dirección hasta que caben sus sillas.
    let anchor = settled.item;
    const axes = along ? [along] : [{ x: 1, y: 0 }, { x: 0, y: 1 }];
    if (groups(anchor).some(({ rule }) => rule.name !== 'alfombra')) {
      // Cuentan las sillas, mesillas y mesa de centro, sin meter bajo la mesa; la alfombra no estorba a nadie.
      const blocking = (candidate: NativeDesignFurniture) => groups(candidate).filter(({ rule }) => rule.name !== 'alfombra')
        .map(({ rule, chosen }) => ({ rule, items: rule.place(candidate, chosen, false) }));
      const fits = (candidate: NativeDesignFurniture) => {
        const before = candidateDoc.furniture.length;
        addSuggestedFurniture(candidateDoc, candidate, rooms, allowedRooms, zone?.polygon);
        const count = blocking(candidate).reduce((total, { rule, items }) => total + items.filter((companion) => {
          const ok = !nativeFurniturePlacementIssue(candidateDoc, companion, rooms, settleRooms, zone?.polygon);
          if (ok) addSuggestedFurniture(candidateDoc, companion, rooms, allowedRooms, zone?.polygon);
          return ok;
        }).slice(0, rule.single?.(catalog) ? 1 : undefined).length, 0);
        candidateDoc.furniture.splice(before);
        return count;
      };
      const wanted = blocking(anchor).reduce((total, { rule, items }) => total + (rule.single?.(catalog) ? 1 : items.length), 0);
      let best = fits(anchor);
      // Exenta, solo si falta la mitad o más: mover una mesa de comedor por una cabecera que no cabe costaba segundos.
      const search = !!along || best * 2 <= wanted;
      for (let step = 1; search && best < wanted && step <= (along ? SHIFT_STEPS : SHIFT_STEPS / 2); step++) for (const axis of axes) for (const sign of [1, -1]) {
        const moved = { ...settled.item, xMm: settled.item.xMm + axis.x * sign * step * 50, yMm: settled.item.yMm + axis.y * sign * step * 50 };
        if (nativeFurniturePlacementIssue(candidateDoc, moved, rooms, settleRooms, zone?.polygon)) continue;
        const count = fits(moved);
        if (count > best) { best = count; anchor = moved; }
      }
    }
    furniture.push(anchor);
    addSuggestedFurniture(candidateDoc, anchor, rooms, allowedRooms, zone?.polygon);
    for (const { rule, key, chosen, items } of groups(anchor)) {
      served.add(key);
      let placed = 0;
      const loose = rule.place(anchor, chosen, false);
      for (const [index, companion] of items.entries()) {
        if (placed && rule.single?.(catalog)) break;
        // Lo que solo cabe lejos de su mesa, cama o sofá ya no forma conjunto con él. Una silla que no entra bajo la mesa
        // (un modelo 3D cuya caja choca con el tablero) se queda tocando el canto.
        const near = (target: NativeDesignFurniture) => {
          const result = settleNativeDesignFurniture(candidateDoc, target, rooms, settleRooms, zone?.polygon);
          return !result.issue && Math.hypot(result.item.xMm - target.xMm, result.item.yMm - target.yMm) <= 150 ? result : null;
        };
        // Primero la comprobación exacta (barata); la búsqueda de un sitio cercano, solo una vez y sin meterla bajo la mesa.
        const exact = [companion, loose[index]].find((target) => target && !nativeFurniturePlacementIssue(candidateDoc, target, rooms, settleRooms, zone?.polygon));
        const seat = exact ? { item: exact, issue: null } : near(loose[index] ?? companion);
        if (!seat) continue;
        furniture.push(seat.item);
        addSuggestedFurniture(candidateDoc, seat.item, rooms, allowedRooms, zone?.polygon);
        placed++;
      }
    }
  }
  // El texto libre del modelo puede atribuir montajes o muebles que el plano no
  // representa. El resumen se construye a partir de la propuesta validada.
  const objectLabels = [...kitchens.map(kitchenLabel), ...furniture.map((item) => getFurnitureCatalogEntry(item.catalogId)?.label ?? item.catalogId)];
  const fixedFinishes = validateFixedFinishes(input.fixedFinishes, document, scope, options.redesignFixed);
  const summary = [`Propuesta ${estiloLabel(style)}: revisa los acabados antes de aplicar.`,
    objectLabels.length ? `Objetos aplicables: ${objectLabels.join(', ')}.` : 'Sin objetos aplicables.',
    fixedFinishes.length ? `Acabados de ${fixedFinishes.length} fijo(s) existentes para revisar.` : '',
    rejected.length ? `Se descartaron ${rejected.length} objeto(s): ${rejected.slice(0, 4).join('; ')}${rejected.length > 4 ? '; y otros' : ''}.` : ''].filter(Boolean).join(' ');
  const roomFinishes = (Array.isArray(input.roomFinishes) ? input.roomFinishes : []).flatMap((raw) => {
    const entry = raw as { roomId?: unknown; floor?: unknown; walls?: unknown };
    const room = rooms.find((item) => item.id === entry.roomId);
    if (!room || !allowedRooms.has(room.id) || typeof entry.floor !== 'string' || !FLOOR_TEXTURES.has(entry.floor)
      || typeof entry.walls !== 'string' || !MATERIAL_IDS.has(entry.walls)) return [];
    return [{ roomId: room.id, name: roomName(document, room), floor: entry.floor as FloorFinish['texture'], walls: entry.walls }];
  }).filter((finish, index, all) => all.findIndex((item) => item.roomId === finish.roomId) === index);
  const exteriorWalls = typeof materials.exteriorWalls === 'string' && MATERIAL_IDS.has(materials.exteriorWalls) ? materials.exteriorWalls : undefined;
  return { rejections, proposal: { style, summary,
    scope, sourceRevision: document.revision, ...(roomFinishes.length ? { roomFinishes } : {}),
    materials: { walls: material('walls', 'plaster-white'), ...(exteriorWalls ? { exteriorWalls } : {}), floors: floor, slabUndersides, stairBodies, rampBodies, landingBodies,
      stairs: material('stairs', 'wood-oak'), ramps: material('ramps', 'concrete-grey'), columns: material('columns', 'concrete-grey') },
    ...(kitchens.length ? { kitchens } : {}), furniture, fixedFinishes } };
}

function toModelCentre(item: NativeDesignFurniture): Point {
  const { cxMm, cyMm } = toModelFurniture(item);
  return { x: cxMm, y: cyMm };
}

/**
 * Nombres que el usuario dio a la estancia en el plano: la IA los necesita para saber cuál es el baño. Un espacio sin
 * tabique entre dos usos (pasillo abierto al lavadero) lleva los dos rótulos y se amuebla para ambos.
 */
function roomName(document: EditorDocument, room: { boundary: Point[] }): string {
  const names = document.labels.filter((label) => pointInPolygon(label, room.boundary)).map((label) => label.text.trim()).filter(Boolean);
  return names.length ? names.join(' y ') : 'Estancia';
}

function overlapsBox(box: { minX: number; minY: number; maxX: number; maxY: number }, polygon: Point[]): boolean {
  const xs = polygon.map((point) => point.x), ys = polygon.map((point) => point.y);
  return box.minX < Math.max(...xs) && box.maxX > Math.min(...xs) && box.minY < Math.max(...ys) && box.maxY > Math.min(...ys);
}

/** Convención del catálogo: la trasera de cada pieza (cabecero, respaldo, cisterna, fondo del armario) está en su y local 0. */
const ORIENTATION_RULE = 'Orientación: rotation solo puede ser 0, 90, 180 o 270 y dice hacia dónde queda la TRASERA de la pieza, el lado que se apoya en el muro (cabecero de la cama, respaldo del sofá o la silla, cisterna del inodoro, fondo del armario, de la cocina o del lavabo); el frente mira al lado contrario. 0 = trasera arriba (y menor), frente hacia abajo. 90 = trasera a la derecha (x mayor), frente a la izquierda. 180 = trasera abajo (y mayor), frente hacia arriba. 270 = trasera a la izquierda (x menor), frente a la derecha. widthxdepth del catálogo es ancho x fondo con giro 0; con 90 o 270 el ancho va en vertical (y) y el fondo en horizontal (x). Ejemplo: una butaca exenta con el respaldo a la derecha y mirando a la izquierda lleva rotation 90. Las sillas de comedor miran a la mesa (su trasera, hacia fuera) y la tocan sin solaparla.';

function placementIssueLabel(issue: NativeFurniturePlacementIssue): string {
  switch (issue) {
    case 'catalog': return 'ficha o coordenadas no válidas';
    case 'room': return 'fuera de la estancia seleccionada';
    case 'zone': return 'fuera de la zona de diseño';
    case 'support': return 'necesita una mesa o encimera bajo toda su base';
    case 'wall': return 'invade una pared';
    case 'collision': return 'solapa la zona de seguridad de un mueble o estructura';
    case 'shelter': return 'invade un poste o lateral de una carpa o pérgola';
    case 'environment': return 'es un objeto de interior y esta zona es exterior';
    case 'circulation': return 'taparía el paso a una escalera, rampa o puerta';
    case 'edge': return 'debe ir junto a un muro o al borde de la zona, no en mitad del espacio';
  }
}

function scopeFromOptions(options: RenderDesignOptions): DesignScope {
  return { kind: options.designScope, roomIds: options.designScope === 'rooms' ? options.designRoomIds : [],
    structureIds: options.designScope === 'rooms' ? options.designStructureIds : [],
    zoneId: options.designScope === 'zone' ? options.designZoneId : undefined };
}

/**
 * La IA elige una pared y un punto de ella, o da el centro de una pieza exenta; el plano guarda la esquina sobre la que
 * gira. Las piezas de pared se pueden deslizar a lo largo de ella al validarlas.
 */
function parseFurniture(value: unknown, faces: ReturnType<typeof proposalFaces>):
  { item: NativeDesignFurniture; along?: Point; roomId?: string }[] {
  if (!value || typeof value !== 'object') return [];
  const raw = value as Record<string, unknown>, catalogId = typeof raw.catalogId === 'string' ? catalogEntryFor(raw.catalogId)?.id ?? '' : '';
  const number = (key: string) => typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? raw[key] as number : undefined;
  const wall = faceFor(faces, raw.wall, number('alongMm')), face = wall?.face;
  if (!getFurnitureCatalogEntry(catalogId) || (!face && ['cxMm', 'cyMm', 'rotation'].some((key) => number(key) === undefined))) return [];
  const model = { catalogId, alongMm: number('alongMm'), cxMm: number('cxMm') ?? 0, cyMm: number('cyMm') ?? 0, rotation: number('rotation') ?? 0,
    reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 180) : '' };
  const placed = fromModelFurniture(face ? placeOnFace(model, face) : model);
  return placed ? [{ item: placed, ...(wall ? { along: faceAxis(wall.face), roomId: wall.roomId } : {}) }] : [];
}

/**
 * El catálogo mezcla prefijos (habiteka:asset:, habiteka:furniture:) y guiones con guiones bajos, y la IA a veces los
 * cruza: «furniture:mesa-comedor-madera» por «asset:mesa_comedor_madera». Si solo cambia eso, es la misma pieza.
 */
function catalogEntryFor(id: string) {
  const exact = getFurnitureCatalogEntry(id.trim());
  if (exact) return exact;
  const key = (value: string) => value.trim().replace(/^habiteka:(asset|furniture):/, '').replace(/[-_]/g, '');
  return FURNITURE_CATALOG.find((entry) => key(entry.id) === key(id));
}

/** Plantas y lámparas de pie de interior; una jardinera del patio se queda donde la puso la IA. */
const hugsWall = (entry: FurnitureCatalogEntry | undefined) => !!entry && entry.room !== 'exterior' && (entry.profile === 'plant' || (entry.profile === 'lamp' && !entry.elevationMm));
/** Cara de pared más cercana a un punto, si el punto cae frente a ella y a menos de 1,2 m. */
function nearestFace(faces: readonly RoomWallFace[], point: Point): RoomWallFace | undefined {
  return faces.map((face) => {
    const horizontal = face.side === 'arriba' || face.side === 'abajo', along = horizontal ? point.x : point.y;
    return { face, distance: along < face.fromMm || along > face.toMm ? Infinity : Math.abs((horizontal ? point.y : point.x) - face.atMm) };
  }).filter(({ distance }) => distance <= 1200).sort((a, b) => a.distance - b.distance)[0]?.face;
}

/** Sanitarios propuestos, agrupados por la estancia de su pared o de su centro. */
function wetFixturesByRoom(rawFurniture: unknown[], faces: ReturnType<typeof proposalFaces>, roomAt: (point: Point) => string | undefined) {
  const byRoom = new Map<string, { raw: unknown; item: NativeDesignFurniture; along?: Point }[]>();
  for (const raw of rawFurniture) {
    const parsed = parseFurniture(raw, faces)[0], room = parsed && (parsed.roomId ?? roomAt(toModelCentre(parsed.item)));
    if (parsed && room && isWetFixture(getFurnitureCatalogEntry(parsed.item.catalogId))) byRoom.set(room, [...(byRoom.get(room) ?? []), { raw, ...parsed }]);
  }
  return byRoom;
}

/** Lado de la estancia hacia el que queda la trasera con cada giro (la del catálogo está en su y local 0). */
const BACK_SIDE: Readonly<Record<number, RoomWallFace['side']>> = { 0: 'arriba', 90: 'derecha', 180: 'abajo', 270: 'izquierda' };
/** Pared contra la que apoya la trasera de una pieza y el tramo que ocupa en ella. */
function wallBehind(faces: readonly RoomWallFace[], item: NativeDesignFurniture): { face: RoomWallFace; from: number; to: number } | undefined {
  const entry = getFurnitureCatalogEntry(item.catalogId), side = BACK_SIDE[((Math.round(item.rotation / 90) * 90) % 360 + 360) % 360];
  if (!entry || !side) return undefined;
  const frame = { x: item.xMm, y: item.yMm, rotation: item.rotation, widthMm: entry.widthMm, depthMm: entry.depthMm };
  const a = localToWorld(frame, { x: 0, y: 0 }), b = localToWorld(frame, { x: entry.widthMm, y: 0 }), horizontal = side === 'arriba' || side === 'abajo';
  const at = horizontal ? a.y : a.x, from = Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y), to = Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y);
  const face = faces.find((candidate) => candidate.side === side && Math.abs(candidate.atMm - at) <= 20 && from >= candidate.fromMm - 1 && to <= candidate.toMm + 1);
  return face ? { face, from, to } : undefined;
}
const underWindow = (faces: readonly RoomWallFace[], item: NativeDesignFurniture) => {
  const behind = wallBehind(faces, item);
  return !!behind && behind.face.windows.some(([from, to]) => from < behind.to && to > behind.from);
};
/** Pared de enfrente de un sofá y el punto de ella que queda frente a su centro. */
function facingWall(faces: readonly RoomWallFace[], sofa: NativeDesignFurniture): { face: RoomWallFace; alongMm: number } | undefined {
  const side = BACK_SIDE[(((Math.round(sofa.rotation / 90) * 90) + 180) % 360 + 360) % 360], centre = toModelCentre(sofa);
  const alongMm = side === 'arriba' || side === 'abajo' ? centre.x : centre.y;
  const face = faces.find((candidate) => candidate.side === side && alongMm >= candidate.fromMm && alongMm <= candidate.toMm);
  return face ? { face, alongMm } : undefined;
}

/** Pieza más pequeña del mismo uso para cuando la elegida no cabe en ninguna pared de su estancia. */
const SMALLER: Readonly<Record<string, string>> = {
  'habiteka:furniture:banera': 'habiteka:furniture:ducha',
  'habiteka:furniture:sofa-3:piel': 'habiteka:furniture:sofa-3',
  'habiteka:furniture:sofa-3': 'habiteka:furniture:sofa-2',
  'habiteka:furniture:armario:grande': 'habiteka:furniture:armario',
  'habiteka:furniture:cama-doble:king': 'habiteka:furniture:cama-doble',
};

/** Hasta 60 cm a cada lado, en pasos de 5 cm, para hacer sitio a las mesillas sin despegar la cama de su pared. */
const SHIFT_STEPS = 12;
/** Piezas que van contra una pared y, si no caben en la elegida, se prueban en otra de la misma estancia. */
const WALL_PROFILES = new Set(['bed', 'sofa', 'sofa-chaise', 'sofa-corner', 'sofa-modular', 'sofa-bed', 'cabinet', 'shelf', 'toilet', 'sink', 'bath', 'shower', 'appliance']);
/**
 * Primera pared de la estancia con un tramo libre donde la pieza cabe: antes las ciegas (una ventana detrás de un
 * cabecero o un armario estorba) y las más largas. La pieza parte del centro del tramo y se desliza por él.
 */
function otherWall<T extends { issue: NativeFurniturePlacementIssue | null }>(faces: readonly RoomWallFace[], attempt: (face: RoomWallFace) => T,
  widthMm: number): T | undefined {
  const longest = (face: RoomWallFace) => Math.max(0, ...face.free.map(([from, to]) => to - from));
  for (const face of [...faces].sort((a, b) => a.windows.length - b.windows.length || longest(b) - longest(a))) {
    const span = face.free.filter(([from, to]) => to - from >= widthMm).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
    if (!span) continue;
    const result = attempt({ ...face, fromMm: span[0], toMm: span[1] });
    if (!result.issue) return result;
  }
  return undefined;
}

/** Paredes de cada estancia con un id corto (E1a, E1b…), iguales en el prompt y al leer la respuesta. */
function proposalFaces(document: EditorDocument, rooms: ReturnType<typeof deriveRooms>, zoned: boolean) {
  const clear = doorClearZones(document), byRoom = new Map<string, RoomWallFace[]>(), byId = new Map<string, { face: RoomWallFace; roomId: string }>();
  const byWall = new Map<string, { face: RoomWallFace; roomId: string }[]>();
  // En una zona dibujada el contorno corta las estancias: sus bordes no son paredes donde apoyar muebles.
  if (!zoned) rooms.forEach((room, index) => {
    const faces = roomWallFaces(document, room, `E${index + 1}`, clear);
    byRoom.set(room.id, faces);
    for (const face of faces) {
      byId.set(face.id, { face, roomId: room.id });
      for (const wallId of face.wallIds) byWall.set(wallId, [...(byWall.get(wallId) ?? []), { face, roomId: room.id }]);
    }
  });
  return { byRoom, byId, byWall };
}

/**
 * Pared nombrada por la IA: su id de cara (E3a) o, si escribe el id del muro del contexto (w4), la cara de ese muro en
 * la que cae el punto pedido. Sin esto, un modelo que nombró los muros así perdía todas sus camas y sanitarios.
 */
function faceFor(faces: ReturnType<typeof proposalFaces>, id: unknown, alongMm?: number) {
  if (typeof id !== 'string' || !id.trim()) return undefined;
  const exact = faces.byId.get(id.trim());
  if (exact) return exact;
  const candidates = faces.byWall.get(id.trim()) ?? [];
  return candidates.find(({ face }) => alongMm !== undefined && alongMm >= face.fromMm && alongMm <= face.toMm) ?? candidates[0];
}

/** Cómo decide la IA dónde va cada pieza: la pared y el punto; la aritmética de la huella la hace el código. */
const PLACEMENT_RULE = 'Cómo colocar cada objeto. Los ids de pared son los de walls de cada estancia (E1a, E3b…), nunca los ids de muro del contexto (w0, w12…). Si va contra una pared (cama, armario, cómoda, sofá, aparador, mueble de TV, librería, mesilla, muebles y electrodomésticos de cocina, sanitarios, lavadora, cortina, y plantas o lámparas de pie de rincón): pon en wall el id de esa pared y en alongMm la coordenada del CENTRO de la pieza a lo largo de la pared (x en paredes arriba/abajo, y en izquierda/derecha), con toda la pieza dentro de un tramo free; el sistema la pega a la cara interior con la trasera contra el muro y la gira sola, así que deja cxMm, cyMm y rotation a 0. Las piezas de una misma pared van seguidas sin solaparse: el centro de la siguiente está a (ancho anterior + ancho propio) / 2 del anterior, o más. Evita el cabecero bajo una ventana si otra pared ciega admite la cama con sus mesillas a los lados. Las mesillas de cada cama, las sillas de una mesa de comedor o de jardín y la mesa de centro delante del sofá las coloca el sistema junto a su cama, mesa o sofá: incluye como mucho una de cada, del modelo que prefieras, y deja sitio para ellas. No pongas un armario ni otra pieza alta delante de una ventana. Si va exenta (mesa de comedor, isla, mesa de centro, alfombra, sillas alrededor de la mesa, butaca, taburetes): deja wall vacío y da cxMm/cyMm (centro de la huella) y rotation según la regla de orientación.';

/**
 * Amueblar del todo: el código compone la cocina y los baños y recoloca lo que no cabe donde lo puso la IA (otra pared,
 * una pieza más pequeña, las plantas contra el muro). En una zona dibujada no hay paredes; en los modos controlados se
 * respeta el sitio que eligió la IA.
 */
function arrangedByCode(options: RenderDesignOptions, zoned: boolean): boolean {
  return options.freedom === 'free' && !zoned;
}

/**
 * Módulos y aparatos de cocina sueltos: con el mueble de cocina sobran. La isla y los taburetes siguen sueltos, y la
 * nevera también cuando el boceto del cliente la dibuja aparte de la encimera.
 */
function looseKitchenPiece(entry: FurnitureCatalogEntry, guided = false): boolean {
  return entry.room === 'cocina' && ['kitchen', 'sink', 'appliance'].includes(entry.profile) && !entry.id.includes('isla')
    && !(guided && /frigorifico|nevera/.test(entry.id));
}

export function kitchenLabel(kitchen: NativeDesignKitchen): string {
  const appliances = kitchen.appliances.map((kind) => KITCHEN_SLOT_DEFAULTS[kind].label.toLowerCase());
  return `Cocina de ${(kitchen.lengthMm / 1000).toFixed(1).replace('.', ',')} m${appliances.length ? ` (${appliances.join(', ')})` : ''}`;
}

/**
 * La IA dice qué cocina quiere (estancia, aparatos, acabados y, si acaso, la pared preferida); el código la monta en
 * lineal o en L sobre las paredes libres de esa estancia.
 */
function parseKitchen(value: unknown, document: EditorDocument, rooms: ReturnType<typeof deriveRooms>, faces: ReturnType<typeof proposalFaces>, guided = false):
  { kitchen: NativeDesignKitchen; roomId: string }[] {
  if (!value || typeof value !== 'object') return [];
  const raw = value as Record<string, unknown>;
  const walls = (Array.isArray(raw.walls) ? raw.walls : typeof raw.wall === 'string' ? [raw.wall] : [])
    .flatMap((id) => {
      const found = faceFor(faces, id);
      // Un muro compartido tiene una cara por estancia: la de la cocina pedida.
      const inRoom = typeof id === 'string' ? faces.byWall.get(id.trim())?.find(({ roomId }) => roomId === raw.roomId) : undefined;
      return inRoom ?? found ? [inRoom ?? found!] : [];
    });
  const roomId = typeof raw.roomId === 'string' && faces.byRoom.has(raw.roomId) ? raw.roomId : walls[0]?.roomId;
  const room = rooms.find((item) => item.id === roomId);
  if (!room) return [];
  const interior = roomInterior(document, room), xs = interior.map((point) => point.x), ys = interior.map((point) => point.y);
  const front = typeof raw.frontColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.frontColor) ? raw.frontColor : undefined;
  const worktop = typeof raw.worktopMaterialId === 'string' && MATERIAL_IDS.has(raw.worktopMaterialId) ? raw.worktopMaterialId : undefined;
  const base = { uppers: raw.uppers !== false, ...(front ? { frontColor: front } : {}), ...(worktop ? { worktopMaterialId: worktop } : {}),
    reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 180) : '' };
  const appliances = (Array.isArray(raw.appliances) ? raw.appliances : []).filter(isKitchenSlotKind);
  return planKitchen(faces.byRoom.get(room.id) ?? [], { x: Math.max(...xs) - Math.min(...xs), y: Math.max(...ys) - Math.min(...ys) },
    appliances, walls.filter((wall) => wall.roomId === room.id).map((wall) => wall.face.id), guided).map(({ arm, appliances: armAppliances }) => ({ roomId: room.id, kitchen: kitchenOnArm(arm, base, armAppliances) }));
}

/** La cocina como un mueble de obra: la IA dice dónde y con qué aparatos; el código monta módulos, encimera y altos. */
const KITCHEN_RULE = 'Cocina: no la compongas con módulos ni electrodomésticos sueltos. En kitchens da una entrada por cada estancia que sea cocina (normalmente una): roomId es su id; walls, la pared o las dos paredes contiguas (en L) que prefieres para la encimera, o [] para que decida el sistema; appliances, los aparatos que lleva (fregadero, vitroceramica, horno, lavavajillas, frigorifico-columna y, si no hay lavadero, lavadora). El sistema monta el mueble de cocina modular (fondo 600 mm, encimera y zócalo continuos) en lineal o en L por las paredes libres con paso delante, con el lavavajillas junto al fregadero, el horno junto a la placa, encimera entre medias y la nevera en un extremo. Una ventana no impide la cocina: la encimera pasa bajo ella y los altos se omiten encima. uppers añade armarios altos. frontColor (#rrggbb) es el color de los frentes y worktopMaterialId un material permitido para la encimera, ambos del estilo pedido. Deja libre el frente de la cocina (1 m): la isla, los taburetes y lo demás van en furniture, fuera de esas paredes. Si la cocina ya tiene muebles de cocina, kitchens va vacío.';

/** Lo que en un boceto va contra una pared; mesas, sillas y alfombras van exentas. */
const SKETCH_WALL_KINDS = new Set(['sofa', 'bed', 'cabinet', 'shelf', 'kitchen', 'sink', 'toilet', 'bath', 'shower', 'appliance', 'bench']);
/** Distancia máxima entre el borde dibujado y la cara del muro para considerar que la pieza va contra él. */
const SKETCH_WALL_REACH_MM = 700;

/** Caras de la estancia contra las que va la caja dibujada, de la más cercana a la más lejana, con la distancia. */
function sketchWalls(faces: readonly RoomWallFace[], item: SketchGuide['items'][number]) {
  const min = { x: item.centreMm.x - item.sizeMm.x / 2, y: item.centreMm.y - item.sizeMm.y / 2 };
  const max = { x: item.centreMm.x + item.sizeMm.x / 2, y: item.centreMm.y + item.sizeMm.y / 2 };
  // Una cama o un inodoro apoyan en el muro su lado corto (cabecero, cisterna); lo demás, el largo. Casi cuadrado, cualquiera.
  const wide = item.sizeMm.x > item.sizeMm.y * 1.25, tall = item.sizeMm.y > item.sizeMm.x * 1.25, shortBack = item.kind === 'bed' || item.kind === 'toilet';
  return faces.flatMap((face) => {
    const horizontal = face.side === 'arriba' || face.side === 'abajo';
    if (item.kind !== 'kitchen' && (wide || tall) && horizontal !== (shortBack ? tall : wide)) return [];
    const [from, to] = horizontal ? [min.x, max.x] : [min.y, max.y];
    if (Math.min(to, face.toMm) - Math.max(from, face.fromMm) <= 0) return [];
    const distance = face.side === 'arriba' ? min.y - face.atMm : face.side === 'abajo' ? face.atMm - max.y
      : face.side === 'izquierda' ? min.x - face.atMm : face.atMm - max.x;
    return distance > -300 && distance <= SKETCH_WALL_REACH_MM ? [{ face, distance: Math.abs(distance), alongMm: Math.round(horizontal ? item.centreMm.x : item.centreMm.y) }] : [];
  }).sort((a, b) => a.distance - b.distance);
}

/**
 * El cliente dibujó su distribución en el boceto con el que importó el plano: Amueblar la reproduce. La importación ya
 * midió la caja de cada mueble; el código deduce de ella la pared y el punto (la IA, sin razonar, leía mal el dibujo y
 * cambiaba la cocina o la cama de pared) y la IA elige la pieza del catálogo mirando la imagen.
 */
function sketchRule(document: EditorDocument, guide: SketchGuide, rooms: ReturnType<typeof deriveRooms>, faces: ReturnType<typeof proposalFaces>): string {
  const items = guide.items.flatMap((item): Record<string, unknown>[] => {
    const room = rooms.find((candidate) => faces.byRoom.has(candidate.id) && pointInPolygon(item.centreMm, candidate.boundary));
    if (!room) return [];
    const walls = SKETCH_WALL_KINDS.has(item.kind) ? sketchWalls(faces.byRoom.get(room.id) ?? [], item) : [];
    const base = { mueble: item.label, estancia: roomName(document, room) };
    if (item.kind === 'kitchen') {
      // La encimera no va en la pared donde el boceto dibuja la mesa de la cocina.
      const tables = guide.items.filter((other) => other.kind === 'table' && pointInPolygon(other.centreMm, room.boundary));
      const taken = new Set(tables.flatMap((table) => sketchWalls(faces.byRoom.get(room.id) ?? [], table).slice(0, 1).map(({ face }) => face.id)));
      return [{ ...base, roomId: room.id, kitchenWalls: walls.filter(({ face }) => !taken.has(face.id)).slice(0, 2).map(({ face }) => face.id) }];
    }
    return [walls[0] ? { ...base, wall: walls[0].face.id, alongMm: walls[0].alongMm } : { ...base, cxMm: item.centreMm.x, cyMm: item.centreMm.y }];
  });
  return [`Boceto del cliente (la última imagen adjunta): es SU distribución, la que quiere ver. Está alineado con el plano: su esquina superior izquierda es (0, 0) mm y la inferior derecha (${guide.frameMm.width}, ${guide.frameMm.height}) mm.`,
    `Reprodúcelo. Estos son los muebles dibujados, con la pared (wall) y el punto (alongMm) que ya se midieron en el boceto, o el centro si van exentos: ${JSON.stringify(items)}. Pon cada uno con ESA wall y ESE alongMm (o ese centro), eligiendo en la imagen y en el catálogo la pieza que corresponde en el estilo pedido: una cama individual dibujada es una cama individual; una mesa con sillas en la cocina, habiteka:furniture:mesa-cocina; en el comedor, la mesa de comedor del tamaño de las sillas dibujadas (sus sillas las pone el sistema). El tipo leído puede estar equivocado (un escritorio leído como mesa de centro): la imagen manda en el tipo, la lista en el sitio.`,
    'La cocina: si la lista trae kitchenWalls, esas son las paredes de la encimera: ponlas tal cual en kitchens.walls y en appliances los aparatos dibujados en ella. Si la nevera está dibujada aparte de la encimera, ponla en furniture contra su pared y no pongas frigorifico-columna.',
    'Después completa lo que el boceto no dibuja y el uso pide (mesillas, lámparas, cortinas, decoración) sin tapar ni mover lo dibujado.'].join('\n');
}
