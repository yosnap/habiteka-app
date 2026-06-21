/**
 * Barrel de los contratos transversales del equipo (API freeze).
 *
 * Cualquier rol importa desde `@/lib/contracts`. Son tipos puros y
 * serializables compartidos entre cliente y servidor; el único runtime de la
 * carpeta es el registry de add-ons, que vive aparte.
 */
export type { TokenUsage, ProviderCost } from './credits';
export type {
  MessagePart,
  ChatRole,
  ChatMessage,
  ToolDefinition,
  JsonSchema,
  ChatRequest,
  ToolCall,
  ChatResult,
  ChatDelta,
  ChatVisionAdapter,
} from './chat-vision-adapter';
export type { ImageGenRequest, InpaintRequest, ImageResult, ImageAdapter } from './image-adapter';
export type { NormalizedBBox, NormalizedPoint, CanvasZone } from './canvas-zone';
export type {
  PlanPoint,
  PlanWall,
  ApertureKind,
  PlanAperture,
  PlanDimension,
  PlanZone,
  Plano2dPayload,
} from './plano2d-payload';
export type { DesignElementKind, DesignElement } from './design-element';
export type { DeliverableType, DeliverablePayload, Deliverable } from './deliverable';
export type {
  AgentPhase,
  Estilo,
  StructuralElements,
  Collected,
  ReadyForDelivery,
  AgentState,
} from './agent-state';
export type { AgentStreamEvent } from './agent-stream';
export type { ProductDrop } from './product-drop-payload';
export type { OperationCost, Hold, DebitService } from './debit-service';
export type { DecorRecommendation } from './decor-recommendation';
export type { DetectedObject, NormalizedBox } from './detected-object';
