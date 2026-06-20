/**
 * Adaptador de chat + visión sobre OpenRouter (implementa el contrato de F0).
 *
 * Traduce el `ChatRequest` neutral a la Chat Completions API: mensajes
 * multimodales, herramientas, salida estructurada (`json_schema` estricto) y
 * respaldo de modelos vía `extra_body.models`. Cada llamada acota su salida con
 * `max_tokens` y, ante caída del gateway, conmuta al secundario.
 */
import type {
  ChatVisionAdapter,
  ChatRequest,
  ChatResult,
  ChatDelta,
  ChatMessage,
  MessagePart,
  ToolCall,
} from '@/lib/contracts';
import { withGatewayFallback } from './client/gateway-fallback';
import { resolveMaxTokens } from './call-limits';
import { toTokenUsage } from './cost/usage-to-cost';
import { aiError } from './errors';

// Estructura mínima de los mensajes que acepta la Chat Completions API. Se tipa
// localmente para no acoplar el contrato neutral a los tipos del SDK.
type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface OpenAIChatMessage {
  role: string;
  content: string | OpenAIContentPart[];
  tool_call_id?: string;
}

export interface ChatAdapterOptions {
  baseURL?: string | null;
  maxTokens?: number;
}

export class OpenRouterChatVisionAdapter implements ChatVisionAdapter {
  constructor(private readonly options: ChatAdapterOptions = {}) {}

  async chat(req: ChatRequest): Promise<ChatResult> {
    const body = this.buildBody(req, false);
    const completion = await withGatewayFallback({
      baseURL: this.options.baseURL ?? null,
      // OpenRouter acepta campos extra (`models`) que no están en los tipos del
      // SDK; se pasa el body construido a su API de Chat Completions.
      run: (client) => client.chat.completions.create(body as never) as Promise<RawCompletion>,
    });

    const choice = completion.choices[0];
    if (!choice) {
      throw aiError('provider_down', 'Respuesta sin choices del proveedor');
    }
    if (choice.finish_reason === 'content_filter') {
      throw aiError('refusal', 'El modelo rechazó la petición');
    }

    const structured = this.parseStructured(req, choice.message.content);
    return {
      content: choice.message.content ?? '',
      toolCalls: mapToolCalls(choice.message.tool_calls),
      structured,
      usage: toTokenUsage(completion.usage),
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatDelta> {
    const body = this.buildBody(req, true);
    const stream = await withGatewayFallback({
      baseURL: this.options.baseURL ?? null,
      run: (client) =>
        client.chat.completions.create(body as never) as unknown as Promise<
          AsyncIterable<RawChunk>
        >,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield { contentDelta: delta.content };
      }
      if (chunk.usage) {
        yield { usage: toTokenUsage(chunk.usage) };
      }
    }
  }

  private buildBody(req: ChatRequest, stream: boolean): RawRequestBody {
    const body: RawRequestBody = {
      model: req.model,
      messages: req.messages.map(toOpenAIMessage),
      max_tokens: resolveMaxTokens(this.options.maxTokens),
      stream,
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.tools) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }
    if (req.responseSchema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: 'structured_output', strict: true, schema: req.responseSchema },
      };
    }
    if (req.fallbackModels?.length) {
      // `extra_body.models` es la forma de OpenRouter de declarar respaldos.
      body.models = [req.model, ...req.fallbackModels].slice(0, 4);
    }
    return body;
  }

  private parseStructured(req: ChatRequest, content: string | null): unknown {
    if (!req.responseSchema || !content) return undefined;
    try {
      return JSON.parse(content);
    } catch (err) {
      throw aiError('schema', 'La salida no es JSON válido contra el schema', err);
    }
  }
}

// --- mapeo de tipos hacia/desde el SDK ---

function toOpenAIMessage(msg: ChatMessage): OpenAIChatMessage {
  return {
    role: msg.role,
    content: msg.content.map(toOpenAIPart),
    ...(msg.toolCallId ? { tool_call_id: msg.toolCallId } : {}),
  };
}

function toOpenAIPart(part: MessagePart): OpenAIContentPart {
  if (part.type === 'text') {
    return { type: 'text', text: part.text };
  }
  // Visión: la URL puede ser nuestra (firmada) o un data-URL base64 re-encodeado
  // server-side. Nunca una URL externa arbitraria del usuario (anti-SSRF).
  const url = part.base64 ? `data:${part.mimeType ?? 'image/png'};base64,${part.base64}` : part.url;
  return { type: 'image_url', image_url: { url: url ?? '' } };
}

function mapToolCalls(raw: RawToolCall[] | undefined): ToolCall[] | undefined {
  if (!raw?.length) return undefined;
  return raw.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: safeParseArgs(tc.function.arguments),
  }));
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// --- formas mínimas de la respuesta del SDK (no se importan sus tipos) ---

interface RawToolCall {
  id: string;
  function: { name: string; arguments: string };
}
interface RawCompletion {
  choices: Array<{
    finish_reason?: string;
    message: { content: string | null; tool_calls?: RawToolCall[] };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}
interface RawChunk {
  choices: Array<{ delta?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}
interface RawRequestBody {
  model: string;
  messages: OpenAIChatMessage[];
  max_tokens: number;
  stream: boolean;
  temperature?: number;
  tools?: unknown[];
  response_format?: unknown;
  models?: string[];
}
