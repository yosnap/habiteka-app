/**
 * Coste de IA → créditos. Tipos puros serializables.
 *
 * El adaptador de chat/imagen reporta consumo en estas unidades neutrales
 * (tokens del proveedor de chat, coste monetario del proveedor de imagen).
 * La traducción a créditos del usuario la realiza la capa de facturación;
 * aquí solo se modela la unidad de medida para no acoplar el agente al
 * esquema de precios.
 */

/** Tokens consumidos por una llamada de chat/visión (OpenRouter). */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  /** Importe reportado por el proveedor; no son créditos internos de Habiteka. */
  reportedCostUsd?: number;
}

/** Coste monetario reportado por un proveedor (típicamente imagen/render). */
export interface ProviderCost {
  amountUsd: number;
  /** Unidad facturada por el proveedor (p. ej. 'image', 'megapixel'). */
  unit: string;
  /** Importe que el proveedor informa haber descontado, cuando lo da (KIE: créditos de la tarea). */
  confirmedUsd?: number;
}
