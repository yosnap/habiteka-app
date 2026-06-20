/**
 * Adaptador de chat + visión sobre la Chat Completions API (OpenRouter).
 *
 * Interfaz común que aísla al agente del SDK concreto del proveedor: los tipos
 * son propios y serializables (no se importa `openai` ni se filtran tipos del
 * SDK al cliente). Modela `messages` / `tools` / `response_format json_schema`
 * porque OpenRouter expone Chat Completions, no la Responses API.
 */
import type { TokenUsage } from './credits';

/** Parte de un mensaje: texto o imagen (visión en la fase de ingesta). */
export type MessagePart =
  | { type: 'text'; text: string }
  | {
      type: 'image_url';
      /** URL remota de la imagen. Excluyente con `base64`. */
      url?: string;
      /** Imagen embebida en base64. Excluyente con `url`. */
      base64?: string;
      /** MIME declarado para que la capa de servidor valide el upload. */
      mimeType?: string;
    };

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: MessagePart[];
  /** Presente en mensajes de rol `tool`: id de la tool-call que responde. */
  toolCallId?: string;
}

/** Definición de una herramienta invocable por el modelo (function calling). */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema de los parámetros (objeto serializable). */
  parameters: JsonSchema;
}

/** Schema JSON estructural y serializable (sin clases ni funciones). */
export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: Array<string | number | boolean>;
  description?: string;
  additionalProperties?: boolean;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Modelo primario en notación OpenRouter (p. ej. 'anthropic/claude-...'). */
  model: string;
  /** Modelos de respaldo (≤3). Mapea a `extra_body.models` de OpenRouter. */
  fallbackModels?: string[];
  tools?: ToolDefinition[];
  /** Fuerza salida estructurada vía `response_format: json_schema`. */
  responseSchema?: JsonSchema;
  temperature?: number;
}

/** Invocación de herramienta emitida por el modelo. */
export interface ToolCall {
  id: string;
  name: string;
  /** Argumentos ya parseados (objeto serializable). */
  arguments: Record<string, unknown>;
}

export interface ChatResult {
  content: string;
  toolCalls?: ToolCall[];
  /** Objeto validado contra `responseSchema` cuando se pidió salida estructurada. */
  structured?: unknown;
  usage: TokenUsage;
}

/** Fragmento incremental del streaming de chat. */
export interface ChatDelta {
  contentDelta?: string;
  toolCall?: ToolCall;
  /** Uso acumulado al cerrar el stream. */
  usage?: TokenUsage;
}

export interface ChatVisionAdapter {
  chat(req: ChatRequest): Promise<ChatResult>;
  chatStream(req: ChatRequest): AsyncIterable<ChatDelta>;
}
