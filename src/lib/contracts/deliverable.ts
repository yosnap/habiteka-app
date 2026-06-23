/**
 * Entregables producidos por el agente (plano 2D, render 3D, memoria).
 *
 * Cada entregable porta un sello legal indeleble obligatorio: toda propuesta es
 * conceptual y requiere validación profesional, así que el sello viaja con el
 * dato y no puede omitirse en el tipo.
 */
import type { Plano2dPayload } from './plano2d-payload';
import type { DesignElement } from './design-element';

export type DeliverableType = 'plano2d' | 'render3d' | 'memoria';

/** Payload tipado según el tipo de entregable (unión discriminada). */
export type DeliverablePayload =
  | { type: 'plano2d'; plano: Plano2dPayload }
  | {
      type: 'render3d';
      /**
       * URL del render. Si es PRESIGNADA (storage propio) caduca; por eso se guarda
       * también `assetKey` y se RE-FIRMA al servir. `assetUrl` queda como respaldo
       * (proveedores que devuelven URL pública/remota, o filas antiguas sin key).
       */
      assetUrl: string;
      /**
       * Clave estable en el object storage para re-firmar una URL fresca al mostrar.
       * Ausente si el render no vive en nuestro storage (URL remota/data URL) o en
       * entregables creados antes de guardar la key.
       */
      assetKey?: string;
    }
  | { type: 'memoria'; markdown: string };

export interface Deliverable {
  id: string;
  type: DeliverableType;
  payload: DeliverablePayload;
  /** Sello legal indeleble. Obligatorio en todo entregable. */
  legalSeal: string;
  /** Versión incremental; el feedback genera nuevas versiones. */
  version: number;
  /** Elementos referenciables (votación/marketplace), si se han extraído. */
  elements?: DesignElement[];
}
