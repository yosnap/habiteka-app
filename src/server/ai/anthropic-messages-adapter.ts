/**
 * Modelos Claude de KIE (Sonnet 5, Opus…), que se piden con el formato de mensajes de Anthropic en
 * `POST {baseURL}/v1/messages` y no con el de OpenAI. Traduce la petición común (sistema, texto, imágenes, herramientas
 * y JSON estructurado) y la respuesta, con el mismo tope de espera y los mismos errores que el resto de proveedores
 * para que el respaldo funcione igual. KIE informa del coste en créditos (`credits_consumed`).
 */
import type { ChatDelta, ChatMessage, ChatRequest, ChatResult, ChatVisionAdapter, MessagePart, ToolCall } from '@/lib/contracts';
import { resolveMaxTokens } from './call-limits';
import { incompleteJsonError, parseStructuredOutput } from './chat-vision-adapter';
import { MODEL_TIMEOUT_MS, NO_CREDIT_MESSAGE } from './client/gateway-fallback';
import { aiError } from './errors';
import { prepareClaudeImage } from './claude-image';
import { KIE_USD_PER_CREDIT } from './image/providers/kie-image';

type Block = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };
interface RawMessage {
  content?: Block[]; stop_reason?: string; credits_consumed?: number;
  usage?: { input_tokens?: number; output_tokens?: number };
  code?: number; msg?: string; error?: { message?: string };
}

export class AnthropicMessagesAdapter implements ChatVisionAdapter {
  constructor(private readonly options: { baseURL: string; apiKey: string; maxTokens?: number }) {}

  async chat(req: ChatRequest): Promise<ChatResult> {
    const response = await this.post(await this.body(req, false), false);
    const message = await response.json().catch((error: unknown) => {
      if ((error as { name?: string } | null)?.name === 'TimeoutError' || (error as { name?: string } | null)?.name === 'AbortError') throw timeoutError(error);
      return null;
    }) as RawMessage | null;
    // KIE también responde 200 con `{ code, msg }` cuando falla.
    if (!message || !Array.isArray(message.content)) throw statusError(message?.code ?? 502, message?.msg ?? message?.error?.message ?? '');
    if (message.stop_reason === 'refusal') throw aiError('refusal', 'El modelo rechazó la petición');
    const text = message.content.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('');
    const answer = message.content.find((block) => block.type === 'tool_use' && block.name === STRUCTURED_TOOL);
    if (req.responseSchema && (message.stop_reason === 'max_tokens' || (!answer?.input && !text.trim()))) throw incompleteJsonError(message.stop_reason === 'max_tokens');
    const toolCalls: ToolCall[] = message.content.filter((block) => block.type === 'tool_use' && block.id && block.name && block.name !== STRUCTURED_TOOL)
      .map((block) => ({ id: block.id!, name: block.name!, arguments: block.input ?? {} }));
    // La salida estructurada llega como argumentos de la herramienta; si el modelo escribió el JSON en texto, también vale.
    const structured = answer?.input ? (wrapped(req.responseSchema) ? answer.input.result : answer.input) : parseStructuredOutput(req, text);
    return { content: text || (structured === undefined ? '' : JSON.stringify(structured)), toolCalls: toolCalls.length ? toolCalls : undefined, structured,
      usage: usage(message.usage?.input_tokens, message.usage?.output_tokens, message.credits_consumed) };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatDelta> {
    const response = await this.post(await this.body(req, true), true);
    const reader = response.body?.getReader();
    if (!reader) throw aiError('gateway_down', 'KIE no devolvió la respuesta en streaming');
    const decoder = new TextDecoder();
    let buffer = '', input = 0, output = 0, credits: number | undefined;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        let event: { type?: string; delta?: { type?: string; text?: string }; message?: RawMessage; usage?: RawMessage['usage']; credits_consumed?: number; error?: { message?: string } };
        try { event = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (event.type === 'error') throw aiError('provider_down', `KIE cortó la respuesta: ${event.error?.message ?? 'error desconocido'}`);
        if (event.type === 'message_start') input = event.message?.usage?.input_tokens ?? input;
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) yield { contentDelta: event.delta.text };
        if (event.type === 'message_delta') { output = event.usage?.output_tokens ?? output; credits = event.credits_consumed ?? credits; }
      }
    }
    yield { usage: usage(input, output, credits) };
  }

  private async body(req: ChatRequest, stream: boolean): Promise<Record<string, unknown>> {
    const system = [...req.messages.filter((message) => message.role === 'system').flatMap((message) => message.content)
      .flatMap((part) => part.type === 'text' && part.text ? [part.text] : []),
    ...(req.responseSchema ? [`Da el resultado llamando a la herramienta ${STRUCTURED_TOOL}, con todos sus campos; no escribas texto aparte.`] : [])].join('\n\n');
    const tools = [...(req.tools ?? []).map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })),
      ...(req.responseSchema ? [{ name: STRUCTURED_TOOL, description: 'Devuelve el resultado con exactamente este esquema.', input_schema: toolSchema(req.responseSchema) }] : [])];
    return {
      model: req.model,
      messages: await Promise.all(req.messages.filter((message) => message.role !== 'system').map(toAnthropicMessage)),
      max_tokens: resolveMaxTokens(req.maxTokens ?? this.options.maxTokens),
      stream,
      ...(system ? { system } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(tools.length ? { tools } : {}),
      // KIE no aplica `output_config`: el JSON se obliga con una herramienta que el modelo debe llamar.
      ...(req.responseSchema ? { tool_choice: { type: 'tool', name: STRUCTURED_TOOL } } : {}),
    };
  }

  /** Sin streaming, el tope cubre toda la respuesta (también la lectura del cuerpo); en streaming, hasta que empieza a llegar. */
  private async post(body: Record<string, unknown>, stream: boolean): Promise<Response> {
    const controller = stream ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS) : undefined;
    const signal = controller?.signal ?? AbortSignal.timeout(MODEL_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${this.options.baseURL}/v1/messages`, {
        method: 'POST', redirect: 'error', signal, body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${this.options.apiKey}`, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      });
    } catch (error) {
      throw signal.aborted ? timeoutError(error) : aiError('gateway_down', 'KIE no responde', error);
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw statusError(response.status, await response.text().catch(() => ''));
    return response;
  }
}

const timeoutError = (cause: unknown) => aiError('timeout', `El modelo no respondió en ${MODEL_TIMEOUT_MS / 60_000} minutos`, cause);

const STRUCTURED_TOOL = 'structured_output';
/** La API exige que el esquema de una herramienta sea un objeto: cualquier otro se envuelve en `result`. */
const wrapped = (schema: ChatRequest['responseSchema']) => !!schema && (schema as { type?: unknown }).type !== 'object';
const toolSchema = (schema: NonNullable<ChatRequest['responseSchema']>) =>
  wrapped(schema) ? { type: 'object', properties: { result: schema }, required: ['result'], additionalProperties: false } : schema;

function statusError(status: number, detail: string) {
  if (status === 402) return aiError('provider_down', NO_CREDIT_MESSAGE);
  if (status === 429) return aiError('rate_limit', 'El modelo está temporalmente saturado; probando la ruta de respaldo');
  if (status === 401 || status === 403) return aiError('provider_down', 'KIE rechaza la API key (401/403). Revísala en Configuración IA');
  if (status >= 500) return aiError('gateway_down', `KIE no responde (${status})`);
  // Cualquier otro rechazo (modelo o campo no admitido) pasa también al respaldo, con el motivo de KIE.
  return aiError('provider_down', `KIE rechazó la petición (${status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
}

function usage(input = 0, output = 0, credits?: number) {
  return { promptTokens: input, completionTokens: output,
    ...(typeof credits === 'number' && Number.isFinite(credits) ? { reportedCostUsd: Math.round(credits * KIE_USD_PER_CREDIT * 1e6) / 1e6 } : {}) };
}

async function toAnthropicMessage(message: ChatMessage) {
  if (message.role === 'tool') {
    const text = message.content.flatMap((part) => part.type === 'text' ? [part.text] : []).join('\n');
    return { role: 'user', content: [{ type: 'tool_result', tool_use_id: message.toolCallId, content: text }] };
  }
  const content: Record<string, unknown>[] = (await Promise.all(message.content.map(toAnthropicPart))).flat();
  for (const call of message.toolCalls ?? []) content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments });
  return { role: message.role === 'assistant' ? 'assistant' : 'user', content };
}

async function toAnthropicPart(part: MessagePart): Promise<Record<string, unknown>[]> {
  // Un bloque de texto vacío lo rechaza la API.
  if (part.type === 'text') return part.text ? [{ type: 'text', text: part.text }] : [];
  return part.base64 || part.url ? [await prepareClaudeImage(part)] : [];
}
