/**
 * Fase de entrega: genera los entregables solicitados, los sella y los persiste,
 * protegiendo el cobro con el patrón reserva/confirma/revierte.
 *
 * Orden deliberado: se RESERVA el crédito antes de generar; si la generación
 * falla, se REVIERTE (no se cobra un trabajo incompleto); al persistir con éxito,
 * se CONFIRMA. La `idempotencyKey` es por operación de entrega, de modo que un
 * reintento no vuelve a cobrar. El sello legal lo añade el servidor, no el modelo.
 */
import type {
  ChatVisionAdapter,
  ImageAdapter,
  DebitService,
  ReadyForDelivery,
  Deliverable,
  DeliverableType,
  Plano2dPayload,
  StructuralElements,
} from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import { EXTERIOR_ZONE_KINDS } from '@/lib/zone-kinds';
import { DELIVERABLE_LEGAL_SEAL } from '../legal/seal';
import { agentError } from '../errors';
import { AiError } from '@/server/ai/errors';
import { isDrawablePlano } from '@/lib/contracts/plano2d-validation';
import type { RenderAuditVerdict } from '@/server/quality/evidence/result-evidence';

export interface DeliveryDeps {
  /** Auditoría del render contra el plano (sección «vision» del perfil). */
  vision: ChatVisionAdapter;
  /** Plano 2D estructurado (sección «plano2d»). */
  plano2d: ChatVisionAdapter;
  /** Memoria de materiales (sección «memoria»). */
  memoria: ChatVisionAdapter;
  image: ImageAdapter;
  /**
   * Extrae el plano real de la imagen de referencia (mismo camino que el estudio de
   * planos). Opcional: sin él, o si la imagen no es una planta legible, se cae al
   * modelo de plano y, en último término, al plano base orientativo.
   */
  planoFromImage?: (image: { base64: string; mimeType: string }) => Promise<Plano2dPayload>;
  debit: DebitService;
  /**
   * Guarda los entregables ANTES de confirmar el cobro: si el guardado falla, la
   * reserva se libera y el usuario no paga un diseño que no llega a «Diseños».
   */
  persist?: (deliverables: Deliverable[]) => Promise<void>;
  /** Genera un id estable para cada entregable (inyectado para testabilidad). */
  newId: (type: DeliverableType) => string;
}

export interface DeliveryInput {
  projectId: string;
  collected: ReadyForDelivery;
  elements?: StructuralElements;
  /**
   * Lienzo del usuario como entrada del render (CRL-4): descripción estructurada
   * de los elementos + imagen de referencia rasterizada. Cuando está presente, el
   * render se condiciona a la disposición dibujada (no parte solo del estilo).
   */
  sketch?: {
    description: string;
    /** Contrato trazable con IDs: solo para el auditor de visión. */
    structuralAudit?: string;
    referenceImage: { base64: string; mimeType: string };
    /** Vistas adicionales del mismo plano; no sustituyen la planta principal. */
    referenceImages?: Array<{ base64: string; mimeType: string }>;
    /** Proporción de la sala (ancho:alto); encuadra el render como el lienzo. */
    aspectRatio: string;
    /**
     * Instrucción libre del usuario en lenguaje natural ("haz la sala más cálida").
     * Ajusta estilo/ambiente; NO debe alterar la disposición del plano.
     */
    promptLibre?: string;
    /** El documento nativo exige una revisión de fidelidad antes de entregar. */
    requiresStructuralValidation?: boolean;
  };
  /**
   * Imagen de referencia para img2img cuando la entrega parte de una FOTO de la
   * zona (flujo del chat), no de un lienzo. El render se condiciona a su estructura.
   * Si hay `sketch`, su `referenceImage` tiene prioridad (la disposición del plano
   * manda). Función del orquestador: cargar los bytes de la foto PRIMARY de la zona.
   */
  referenceImage?: { base64: string; mimeType: string };
  /**
   * Tipo de la zona (interior/exterior). Adapta el prompt del render: un interior y
   * una fachada/jardín se describen distinto. `null` = sin zona o sin tipo → interior
   * por defecto.
   */
  zoneKind?: string | null;
  /** Clave idempotente de ESTA operación de entrega. */
  idempotencyKey: string;
  /** Créditos estimados a reservar. */
  estimateCredits: number;
  /**
   * Recoge el veredicto del auditor de visión de cada render aceptado, por id de
   * entregable. Lo rellena la entrega y lo consume la evaluación posterior de
   * calidad (Jev puntúa ese veredicto textual, nunca la imagen). Opcional: sin
   * mapa, la entrega se comporta igual.
   */
  audits?: Map<string, RenderAuditVerdict>;
}

/**
 * Ejecuta la entrega completa. Devuelve los entregables sellados y persistibles.
 * El llamador (orquestador) los guarda y transiciona; aquí se concentra el cobro
 * y la generación para que el orden reserva→genera→confirma sea atómico de leer.
 */
export async function runDelivery(
  deps: DeliveryDeps,
  input: DeliveryInput,
): Promise<Deliverable[]> {
  const hold = await deps.debit.hold(input.idempotencyKey, {
    kind: 'tokens',
    usage: { promptTokens: input.estimateCredits, completionTokens: 0 },
  });

  try {
    const deliverables: Deliverable[] = [];
    for (const type of input.collected.entregables) {
      deliverables.push(await generateOne(deps, input, type));
    }
    await deps.persist?.(deliverables);
    // Éxito: confirmar el cobro con el coste real (aquí, el estimado).
    await deps.debit.settle(hold, {
      kind: 'tokens',
      usage: { promptTokens: input.estimateCredits, completionTokens: 0 },
    });
    return deliverables;
  } catch (err) {
    // Fallo a mitad: liberar la reserva para no cobrar un trabajo incompleto.
    await deps.debit.revert(hold);
    // Los errores de proveedor ya están normalizados y son seguros para la UI
    // (no incluyen claves ni payloads). No los tapes con un 500 genérico: el
    // usuario necesita saber si debe reintentar, revisar créditos o configurar
    // una URL pública para la referencia.
    if (err instanceof AiError || (err instanceof Error && err.name === 'AgentError')) throw err;
    const detail =
      err instanceof Error ? err.message.slice(0, 300) : 'Error inesperado del proveedor';
    throw agentError('schema_repair_failed', `La generación del entregable falló: ${detail}`, err);
  }
}

async function generateOne(
  deps: DeliveryDeps,
  input: DeliveryInput,
  type: DeliverableType,
): Promise<Deliverable> {
  const id = deps.newId(type);
  const base = { id, type, legalSeal: DELIVERABLE_LEGAL_SEAL, version: 1 };

  if (type === 'plano2d') {
    const plano = await generatePlano(deps, input);
    return { ...base, payload: { type: 'plano2d', plano } };
  }
  if (type === 'render3d') {
    // Referencia para img2img: el lienzo tiene prioridad (la disposición del plano
    // manda); si no hay lienzo, la foto de la zona (flujo del chat). Sin ninguna de
    // las dos, el render parte solo del estilo (comportamiento previo).
    const referenceImage = input.sketch?.referenceImage ?? input.referenceImage;
    const referenceImages =
      input.sketch?.referenceImages ?? (referenceImage ? [referenceImage] : []);
    const result = await deps.image.generate({
      prompt: renderPrompt(input),
      // Desde el lienzo: su proporción y disposición condicionan el render. Sin
      // lienzo (entrada por foto/chat), se usa el encuadre panorámico por defecto.
      aspectRatio: input.sketch?.aspectRatio ?? '16:9',
      ...(referenceImage ? { referenceImage } : {}),
      ...(referenceImages.length ? { referenceImages } : {}),
    });
    if (input.sketch?.requiresStructuralValidation) {
      const verdict = await assertStructuralRender(deps.vision, input, result.assetUrl, referenceImages);
      input.audits?.set(id, verdict);
    }
    return {
      ...base,
      // `assetKey` (si el render vive en nuestro storage) permite re-firmar la URL al
      // mostrar: la presignada de `assetUrl` caduca y dejaría la imagen rota.
      payload: {
        type: 'render3d',
        assetUrl: result.assetUrl,
        ...(result.assetKey ? { assetKey: result.assetKey } : {}),
      },
    };
  }
  // memoria de materiales (texto)
  const memoria = await deps.memoria.chat({
    model: '',
    messages: [{ role: 'user', content: [{ type: 'text', text: memoriaPrompt(input) }] }],
  });
  return { ...base, payload: { type: 'memoria', markdown: memoria.content } };
}

const STRUCTURAL_RENDER_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['accepted', 'violations'],
  properties: {
    accepted: { type: 'boolean' },
    violations: { type: 'array', items: { type: 'string' } },
  },
};

/** Solo se entrega un render V2 que no contradiga su plano ni muestre datos internos. */
async function assertStructuralRender(
  chat: ChatVisionAdapter,
  input: DeliveryInput,
  assetUrl: string,
  references: Array<{ base64: string; mimeType: string }>,
): Promise<RenderAuditVerdict> {
  const result = await chat.chat({
    model: '', responseSchema: STRUCTURAL_RENDER_SCHEMA, temperature: 0,
    messages: [{
      role: 'user', content: [
        { type: 'text', text: [
          'Audita el render generado contra el contrato y las dos referencias adjuntas.',
          'Recházalo si muestra texto, IDs, cotas o etiquetas; si duplica, omite, mueve o gira una rampa, escalera, descansillo, columna, muro o hueco; o si cambia una plataforma/suelo elevado o el número de recorridos.',
          'No aceptes una aproximación estética: ante duda, rechaza.',
          `CONTRATO:\n${input.sketch?.structuralAudit ?? input.sketch?.description ?? ''}`,
        ].join('\n') },
        ...references.map((reference) => ({ type: 'image_url' as const, base64: reference.base64, mimeType: reference.mimeType })),
        { type: 'image_url', url: assetUrl },
      ],
    }],
  });
  const verdict = result.structured;
  if (!isStructuralVerdict(verdict) || !verdict.accepted) {
    const detail = isStructuralVerdict(verdict) && verdict.violations.length
      ? `: ${verdict.violations.join('; ').slice(0, 300)}` : '';
    throw agentError('schema_repair_failed', `El render se descartó porque no respeta el plano${detail}`);
  }
  return verdict;
}

function isStructuralVerdict(value: unknown): value is { accepted: boolean; violations: string[] } {
  return typeof value === 'object' && value !== null
    && typeof (value as { accepted?: unknown }).accepted === 'boolean'
    && Array.isArray((value as { violations?: unknown }).violations)
    && (value as { violations: unknown[] }).violations.every((item) => typeof item === 'string');
}

async function generatePlano(deps: DeliveryDeps, input: DeliveryInput): Promise<Plano2dPayload> {
  // 1) Con imagen del espacio, se lee su planta con el extractor del estudio: es lo
  //    único que produce un plano fiel. Antes el modelo recibía solo el objetivo en
  //    texto, nunca devolvía un plano válido y se entregaba un rectángulo genérico.
  const reference = input.referenceImage;
  if (reference && deps.planoFromImage) {
    try {
      const plano = await deps.planoFromImage(reference);
      if (isPlano(plano)) return plano;
    } catch (err) {
      // Una imagen que no es una planta legible (p. ej. foto en perspectiva) degrada;
      // un fallo del proveedor (cuota, caída, credenciales) se muestra al usuario.
      rethrowProviderFailure(err);
    }
  }
  // 2) Modelo de plano estructurado, con la imagen adjunta si la hay.
  try {
    const result = await deps.plano2d.chat({
      model: '',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: planoPrompt(input) },
          ...(reference ? [{ type: 'image_url' as const, base64: reference.base64, mimeType: reference.mimeType }] : []),
        ],
      }],
      responseSchema: PLANO_SCHEMA,
    });
    // Geometría escrita por el modelo sin lectura de la planta: útil, pero no fiel.
    if (isPlano(result.structured)) return { ...result.structured, aproximado: true };
  } catch (err) {
    rethrowProviderFailure(err);
  }
  // 3) Plano base orientativo, marcado como tal para que la UI no lo presente como fiel.
  return basePlano(input.elements);
}

// Fallos de infraestructura: el usuario debe saber que puede reintentar o revisar la
// configuración, en vez de recibir (y pagar) un plano genérico sin explicación.
const PROVIDER_FAILURES = new Set(['rate_limit', 'spend_cap', 'call_limit', 'provider_down', 'gateway_down', 'timeout']);

function rethrowProviderFailure(err: unknown): void {
  if (err instanceof AiError && PROVIDER_FAILURES.has(err.kind)) throw err;
}

// El esquema describe la zona completa: con `items: { type: 'object' }` a secas, la salida estructurada
// del proveedor devolvía zonas vacías `{}` que el visor no podía dibujar.
const POINT_SCHEMA = { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: { type: 'number' }, y: { type: 'number' } } };
/** Esquema de una zona (estancia) del plano; también lo usa la regeneración parcial. */
export const PLAN_ZONE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'outline', 'walls', 'apertures', 'dimensions'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    outline: { type: 'array', items: POINT_SCHEMA },
    walls: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'from', 'to', 'thicknessMm'],
      properties: { id: { type: 'string' }, from: POINT_SCHEMA, to: POINT_SCHEMA, thicknessMm: { type: 'number' } } } },
    apertures: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'kind', 'wallId', 'position', 'widthMm'],
      properties: { id: { type: 'string' }, kind: { type: 'string', enum: ['puerta', 'ventana', 'hueco'] }, wallId: { type: 'string' },
        position: { type: 'number' }, widthMm: { type: 'number' } } } },
    dimensions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'from', 'to', 'label'],
      properties: { id: { type: 'string' }, from: POINT_SCHEMA, to: POINT_SCHEMA, label: { type: 'string' } } } },
  },
};

const PLANO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'zones'],
  properties: {
    schemaVersion: { type: 'integer' },
    zones: { type: 'array', items: PLAN_ZONE_SCHEMA },
  },
};

/** Solo se acepta un plano dibujable; lo demás cae al plano base editable. */
function isPlano(v: unknown): v is Plano2dPayload {
  return isDrawablePlano(v);
}

/**
 * Plano base: una estancia rectangular con cuatro paredes y las aperturas
 * detectadas distribuidas, en milímetros. Sirve como punto de partida editable
 * cuando el modelo no devuelve un plano estructurado válido.
 */
function basePlano(elements?: StructuralElements): Plano2dPayload {
  const W = 4000;
  const H = 3000;
  const corners = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ];
  const walls = corners.map((from, i) => {
    const to = corners[(i + 1) % corners.length]!;
    return { id: `w${i}`, from, to, thicknessMm: 120 };
  });
  // Los recuentos detectados son de TODA la vivienda; en una sola estancia se
  // acotan y se reparten entre paredes para no apilar huecos en una misma pared.
  const doors = Math.min(Math.max(elements?.doors ?? 1, 1), 2);
  const windows = Math.min(elements?.windows ?? 0, 4);
  const spread = (count: number, wallIds: string[]) =>
    Array.from({ length: count }, (_, i) => {
      const wallId = wallIds[i % wallIds.length]!;
      const onWall = Math.ceil((count - (i % wallIds.length)) / wallIds.length);
      const slot = Math.floor(i / wallIds.length);
      return { wallId, position: (slot + 1) / (onWall + 1) };
    });
  const apertures = [
    ...spread(doors, ['w3', 'w1']).map((a, i) => ({
      id: `d${i}`, kind: 'puerta' as const, ...a, widthMm: 900,
    })),
    ...spread(windows, ['w0', 'w2']).map((a, i) => ({
      id: `v${i}`, kind: 'ventana' as const, ...a, widthMm: 1200,
    })),
  ];
  return {
    schemaVersion: 1,
    aproximado: true,
    zones: [{ id: 'z0', name: 'Estancia', outline: corners, walls, apertures, dimensions: [] }],
  };
}

/** True si la zona es un espacio exterior (decide la variante del prompt del render). */
export function isExteriorZone(kind?: string | null): boolean {
  if (!kind) return false;
  const normalized = kind
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return EXTERIOR_ZONE_KINDS.has(normalized);
}

/**
 * Prompt del render 3D. Adapta la descripción del espacio a interior/exterior según
 * el tipo de zona y, cuando parte de una foto de referencia (img2img sin lienzo),
 * pide explícitamente respetar su estructura para que NO invente otro inmueble.
 * Función pura (testeable).
 */
export function renderPrompt(input: DeliveryInput): string {
  const espacio = isExteriorZone(input.zoneKind)
    ? 'del EXTERIOR de la vivienda (fachada/jardín, con entorno y vegetación coherentes)'
    : 'del INTERIOR del espacio';
  const base = [
    `Render arquitectónico fotorrealista ${espacio}, estilo ${estiloLabel(input.collected.estilo)}. ${input.collected.objetivo ?? ''}`,
    'Calidad editorial de interiorismo: luz físicamente coherente, materiales reales, escala humana, un único punto de fuga y composición limpia.',
    'No incluyas cotas, etiquetas, texto, rejilla, controles de interfaz, planos superpuestos ni elementos arquitectónicos inventados.',
  ].join(' ');
  const uso = spaceDesignRule(input.zoneKind);
  // Cuando el render parte del lienzo, su descripción estructurada guía la
  // disposición de los elementos (complementa a la imagen de referencia).
  if (!input.sketch) {
    // Sin lienzo pero CON foto de la zona: img2img. Se ancla el render a la foto
    // para que respete su estructura/perspectiva en vez de inventar otra escena.
    if (input.referenceImage) {
      return (
        `${base}\n\nPARTE de la foto adjunta del espacio real: respeta su estructura, ` +
        `geometría, perspectiva, ventanas y puertas; aplica únicamente el estilo, los ` +
        `acabados y la decoración pedidos SIN inventar otro inmueble ni reubicar las paredes.`
      );
    }
    return base;
  }
  const parts = [
    base,
    uso,
    'La imagen adjunta y el contexto estructurado son una restricción dura: conserva la topología, medidas relativas y cotas. El campo floors define el suelo acabado de cada estancia: cuando su cota sea mayor que cero, es una plataforma elevada y su cara inferior/forjado debe existir bajo el suelo. Las rampas y escaleras de ambos lados han de partir del terreno o su cota de arranque y terminar exactamente sobre ese mismo suelo acabado elevado, incluidos sus descansillos; nunca las aplanes, las dejes flotando ni las hagas llegar al terreno. No alteres la posición, sección, cota base ni altura de columnas y pilares. Conserva los pasos y no cambies de sitio la estructura.',
    input.sketch.description,
    'Los identificadores del contrato (por ejemplo R-01, F-01 o C-01) son datos internos para razonar: NUNCA los dibujes, rotules, grabes ni muestres como texto, cotas o marcas en el render final.',
  ];
  const libre = input.sketch.promptLibre?.trim();
  if (libre) {
    // El prompt libre AJUSTA estilo/ambiente; se coloca DESPUÉS de la disposición
    // y se acota explícitamente para que el modelo no reubique los elementos.
    parts.push(
      `Además, el usuario pide: "${libre}". Aplica ese ajuste de estilo, ambiente o ` +
        `decoración SIN cambiar la disposición, la pared ni la orientación de los elementos ` +
        `descritos arriba.`,
    );
  }
  return parts.join('\n\n');
}

function spaceDesignRule(kind?: string | null): string {
  switch (kind) {
    case 'patio':
      return 'Es un PATIO EXTERIOR abierto. No lo trates como salón ni añadas sofás, comedor interior, techo o paredes inexistentes. Prioriza pavimento exterior, drenaje, vegetación, sombra ligera, iluminación exterior y circulación segura hacia rampas o escaleras.';
    case 'terraza':
      return 'Es una TERRAZA o AZOTEA exterior. No la conviertas en habitación cerrada. Propón acabados resistentes a la intemperie, vegetación, sombra, iluminación exterior y mobiliario exterior solo si cabe y no se solicitó mantenerla vacía.';
    case 'jardin':
      return 'Es un JARDÍN exterior. Conserva la topografía y los recorridos; prioriza vegetación, drenaje, pavimentos permeables, iluminación exterior y mobiliario de jardín solo cuando sea coherente.';
    case 'entrada':
      return 'Es una ENTRADA EXTERIOR. Mantén libre el acceso y prioriza recorrido, seguridad, iluminación exterior y materiales resistentes.';
    case 'fachada':
      return 'Es una FACHADA EXTERIOR. No inventes una estancia interior ni mobiliario; conserva todos los huecos y proporciones arquitectónicas.';
    default:
      return 'Es una HABITACIÓN INTERIOR. Diseña distribución, iluminación y mobiliario de interior respetando la circulación estructural.';
  }
}

/**
 * Prompt para la 2ª llamada de chat que EXPLICA, en una o dos frases y en primera
 * persona, las decisiones del diseño según lo que pidió el usuario. Función pura.
 */
export function explanationPrompt(input: DeliveryInput): string {
  const libre = input.sketch?.promptLibre?.trim();
  const objetivo = input.collected.objetivo?.trim();
  const intencion =
    libre || objetivo || `un diseño de estilo ${estiloLabel(input.collected.estilo)}`;
  return [
    `Eres un interiorista. Acabas de generar un render para este espacio:`,
    input.sketch?.description ?? `Estilo ${estiloLabel(input.collected.estilo)}.`,
    '',
    `El usuario pidió: "${intencion}".`,
    `Explica en 1-2 frases, en primera persona y tono cercano, qué decisiones de diseño tomaste`,
    `y por qué (p. ej. "centré el sofá para dejar paso a la puerta"). No listes; sé concreto y breve.`,
  ].join('\n');
}
/**
 * Prompt de la memoria de materiales (borrador de decoración, F5b). Pide a la IA
 * una propuesta CONCRETA de acabados según estilo + objetivo; si el render parte
 * del plano, incorpora su descripción (que ya trae medidas reales por la escala
 * F0) para que estime cantidades aproximadas. Función pura (testeable).
 */
export function memoriaPrompt(input: DeliveryInput): string {
  const objetivo = input.collected.objetivo?.trim();
  const lines = [
    `Eres un interiorista. Redacta una MEMORIA DE MATERIALES en español para un espacio`,
    `de estilo ${estiloLabel(input.collected.estilo)}${objetivo ? `, con el objetivo: "${objetivo}"` : ''}.`,
    '',
    `Propón materiales y acabados CONCRETOS, organizados por secciones:`,
    `- Suelo, Paredes y techo, Iluminación, Textiles y tapizados, Paleta de color.`,
    `Para cada uno indica material/acabado y un porqué breve acorde al estilo y objetivo.`,
  ];
  if (input.sketch) {
    lines.push(
      '',
      `Este es el plano del espacio (con medidas reales si están disponibles); úsalo para`,
      `estimar cantidades aproximadas (p. ej. m² de suelo) cuando puedas:`,
      input.sketch.description,
    );
  }
  lines.push('', `Sé concreto y conciso; formato markdown con encabezados por sección.`);
  return lines.join('\n');
}
function planoPrompt(input: DeliveryInput): string {
  return [
    'Devuelve el plano 2D en planta del espacio, estructurado en zonas (una por estancia).',
    'Coordenadas en milímetros; muros con grosor; puertas y ventanas sobre su muro.',
    input.referenceImage
      ? 'Básate EXCLUSIVAMENTE en la imagen adjunta: respeta su distribución, estancias y huecos.'
      : '',
    `Objetivo del usuario: ${input.collected.objetivo ?? 'reforma'}.`,
  ].filter(Boolean).join('\n');
}
