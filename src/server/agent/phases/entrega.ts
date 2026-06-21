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
      aspectRatio: '16:9',
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
  return `Render 3D conceptual, estilo ${input.collected.estilo}. ${input.collected.objetivo ?? ''}`;
}
function memoriaPrompt(input: DeliveryInput): string {
  return `Memoria de materiales para un espacio estilo ${input.collected.estilo}.`;
}
function planoPrompt(input: DeliveryInput): string {
  return `Plano 2D estructurado en zonas para el objetivo: ${input.collected.objetivo ?? 'reforma'}.`;
}
