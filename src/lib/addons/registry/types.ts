/**
 * Tipos del registry de add-ons.
 *
 * El MVP registra solo add-ons de primera parte (votación, marketplace), pero
 * las interfaces quedan listas para terceros: metadatos + puntos de extensión
 * (slots), sin carga dinámica de plugins (no hace falta todavía).
 */

/** Puntos de extensión donde un add-on puede engancharse. */
export type ExtensionSlot = 'canvas.toolbar' | 'canvas.layers' | 'agent.postEntrega';

export interface AddonDefinition {
  id: string;
  name: string;
  /** Versión del SDK contra la que se construyó el add-on (semver). */
  sdkVersion: string;
  /** Slots que el add-on utiliza. */
  slots: ExtensionSlot[];
}
