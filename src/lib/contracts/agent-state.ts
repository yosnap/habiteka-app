/**
 * Estado de fase del agente intérprete (5 fases), serializable a JSONB.
 *
 * `Collected` es la fuente del guard legal: la entrega queda bloqueada si falta
 * el `estilo` o si no hay `entregables`. Por eso `Collected` está bien tipado
 * (no `Record<string, unknown>`) y se define el subtipo `ReadyForDelivery`, que
 * solo es satisfacible cuando esos requisitos están presentes — el sistema de
 * tipos rechaza en compilación un estado incompleto marcado como listo.
 */
import type { DeliverableType, Deliverable } from './deliverable';

export type AgentPhase = 'ingesta' | 'cualificacion' | 'entrega' | 'feedback' | 'addons';

export type Estilo =
  | 'minimalista'
  | 'moderno'
  | 'clasico'
  | 'industrial'
  | 'rustico'
  | 'mediterraneo'
  | 'nordico'
  | 'japandi'
  | 'boho'
  | 'midcentury'
  | 'costero'
  | 'contemporaneo'
  | 'escandinavo'
  | 'artdeco'
  | 'tropical';

/**
 * Qué quiere hacer el usuario en el asistente, elegido en el paso 0:
 * `design` = crear un diseño a partir de una foto (flujo de seis pasos);
 * `plan` = convertir un plano al editor (lectura + fiabilidad + importación).
 * Se persiste para que al recargar el asistente retome la ruta elegida.
 */
export type AssistantIntent = 'design' | 'plan';

/** Elementos estructurales detectados por visión en la fase de ingesta. */
export interface StructuralElements {
  walls: number;
  doors: number;
  windows: number;
  pillars: number;
}

/**
 * Qué clase de imagen ha subido el usuario en la ingesta. Un `floor_plan` en la
 * ruta de diseño avisa: el render por imagen partiría de una planta y devolvería
 * una maqueta, no una perspectiva fiel.
 */
export type ImageKind = 'floor_plan' | 'room_photo' | 'other';

/**
 * Estilo/objetivo específicos de una zona, que prevalecen sobre los globales del
 * inmueble (multi-zona). Ambos opcionales: una zona sin override hereda lo global.
 */
export interface ZoneStyleOverride {
  estilo?: Estilo;
  objetivo?: string;
}

/**
 * Requisitos consolidados durante la cualificación.
 * `estilo` y `entregables` son la condición del guard legal de entrega.
 */
export interface Collected {
  /** Ruta elegida en el paso 0 del asistente; sin valor aún no se ha elegido. */
  intent?: AssistantIntent;
  objetivo?: string;
  estilo?: Estilo;
  /** Tipos de entregable solicitados. Vacío ⇒ no se puede entregar. */
  entregables: DeliverableType[];
  detected?: StructuralElements;
  /** Qué era la última imagen analizada; sin valor, aún no se ha subido ninguna. */
  imageKind?: ImageKind;
  /**
   * Overrides de estilo/objetivo por zona (multi-zona), indexados por `zoneId`.
   * El chat fija lo GLOBAL del inmueble; cada zona puede especializarlo desde el
   * editor de su plano. Opcional: sin entrada, la zona usa el estilo global.
   */
  zoneOverrides?: Record<string, ZoneStyleOverride>;
}

/**
 * Refinamiento de `Collected` que SOLO es satisfacible cuando el guard legal
 * pasa: `estilo` definido y al menos un entregable. Un `Collected` incompleto
 * no es asignable a este tipo (error en compilación).
 */
export interface ReadyForDelivery extends Collected {
  estilo: Estilo;
  entregables: [DeliverableType, ...DeliverableType[]];
}

export interface AgentState {
  phase: AgentPhase;
  projectId: string;
  collected: Collected;
  deliverables: Deliverable[];
  /** Marca temporal ISO-8601 de la última actualización (serializable). */
  updatedAt: string;
}
