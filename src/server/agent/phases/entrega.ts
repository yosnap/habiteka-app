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
import { DELIVERABLE_LEGAL_SEAL } from '../legal/seal';
import { agentError } from '../errors';

export interface DeliveryDeps {
  chat: ChatVisionAdapter;
  image: ImageAdapter;
  debit: DebitService;
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
    referenceImage: { base64: string; mimeType: string };
    /** Proporción de la sala (ancho:alto); encuadra el render como el lienzo. */
    aspectRatio: string;
    /**
     * Instrucción libre del usuario en lenguaje natural ("haz la sala más cálida").
     * Ajusta estilo/ambiente; NO debe alterar la disposición del plano.
     */
    promptLibre?: string;
  };
  /** Clave idempotente de ESTA operación de entrega. */
  idempotencyKey: string;
  /** Créditos estimados a reservar. */
  estimateCredits: number;
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
    // Éxito: confirmar el cobro con el coste real (aquí, el estimado).
    await deps.debit.settle(hold, {
      kind: 'tokens',
      usage: { promptTokens: input.estimateCredits, completionTokens: 0 },
    });
    return deliverables;
  } catch (err) {
    // Fallo a mitad: liberar la reserva para no cobrar un trabajo incompleto.
    await deps.debit.revert(hold);
    if (err instanceof Error && err.name === 'AgentError') throw err;
    throw agentError('schema_repair_failed', 'La generación del entregable falló', err);
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
    const result = await deps.image.generate({
      prompt: renderPrompt(input),
      // Desde el lienzo: su proporción y disposición condicionan el render. Sin
      // lienzo (entrada por foto/chat), se usa el encuadre panorámico por defecto.
      aspectRatio: input.sketch?.aspectRatio ?? '16:9',
      ...(input.sketch ? { referenceImage: input.sketch.referenceImage } : {}),
    });
    return { ...base, payload: { type: 'render3d', assetUrl: result.assetUrl } };
  }
  // memoria de materiales (texto)
  const memoria = await deps.chat.chat({
    model: '',
    messages: [{ role: 'user', content: [{ type: 'text', text: memoriaPrompt(input) }] }],
  });
  return { ...base, payload: { type: 'memoria', markdown: memoria.content } };
}

async function generatePlano(deps: DeliveryDeps, input: DeliveryInput): Promise<Plano2dPayload> {
  // Se pide al modelo un plano estructurado; si no respeta el formato (frecuente
  // con planos métricos), se cae a un plano base derivado de lo detectado en vez
  // de fallar: el feedback por zona permitirá refinarlo después.
  try {
    const result = await deps.chat.chat({
      model: '',
      messages: [{ role: 'user', content: [{ type: 'text', text: planoPrompt(input) }] }],
      responseSchema: PLANO_SCHEMA,
    });
    if (isPlano(result.structured)) return result.structured;
  } catch {
    // Cae al plano base.
  }
  return basePlano(input.elements);
}

const PLANO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'zones'],
  properties: {
    schemaVersion: { type: 'integer' },
    zones: { type: 'array', items: { type: 'object' } },
  },
};

function isPlano(v: unknown): v is Plano2dPayload {
  return typeof v === 'object' && v !== null && Array.isArray((v as { zones?: unknown }).zones);
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
  const doors = elements?.doors ?? 1;
  const windows = elements?.windows ?? 0;
  const apertures = [
    ...Array.from({ length: doors }, (_, i) => ({
      id: `d${i}`,
      kind: 'puerta' as const,
      wallId: 'w3',
      position: (i + 1) / (doors + 1),
      widthMm: 900,
    })),
    ...Array.from({ length: windows }, (_, i) => ({
      id: `v${i}`,
      kind: 'ventana' as const,
      wallId: 'w0',
      position: (i + 1) / (windows + 1),
      widthMm: 1200,
    })),
  ];
  return {
    schemaVersion: 1,
    zones: [{ id: 'z0', name: 'Estancia', outline: corners, walls, apertures, dimensions: [] }],
  };
}

function renderPrompt(input: DeliveryInput): string {
  const base = `Render 3D conceptual, estilo ${estiloLabel(input.collected.estilo)}. ${input.collected.objetivo ?? ''}`;
  // Cuando el render parte del lienzo, su descripción estructurada guía la
  // disposición de los elementos (complementa a la imagen de referencia).
  if (!input.sketch) return base;
  const parts = [base, input.sketch.description];
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

/**
 * Prompt para la 2ª llamada de chat que EXPLICA, en una o dos frases y en primera
 * persona, las decisiones del diseño según lo que pidió el usuario. Función pura.
 */
export function explanationPrompt(input: DeliveryInput): string {
  const libre = input.sketch?.promptLibre?.trim();
  const objetivo = input.collected.objetivo?.trim();
  const intencion = libre || objetivo || `un diseño de estilo ${estiloLabel(input.collected.estilo)}`;
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
  return `Plano 2D estructurado en zonas para el objetivo: ${input.collected.objetivo ?? 'reforma'}.`;
}
