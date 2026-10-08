/**
 * Entregables producidos por el agente (plano 2D, render 3D, memoria).
 *
 * Cada entregable porta un sello legal indeleble obligatorio: toda propuesta es
 * conceptual y requiere validación profesional, así que el sello viaja con el
 * dato y no puede omitirse en el tipo.
 */
import type { Plano2dPayload } from './plano2d-payload';
import type { DesignElement } from './design-element';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';

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
      /** Conservación exterior de un retoque; no acredita fidelidad dentro de la zona. */
      imageEdit?: NonNullable<import('./image-adapter').ImageResult['regionEdit']> & { sourceDeliverableId: string };
      camera?: import('./walkthrough-keyframe').CameraPose;
      generation?: {
        provider?: string; model?: string; fallbackIndex?: number;
        promptVersion: string; documentRevision: number;
        view?: import('@/lib/editor-document/render-view').RenderView;
        options?: RenderDesignOptions;
        batchId?: string;
        referenceDesignId?: string;
        /** Lectura de la referencia aceptada realizada sin mostrar la candidata. */
        acceptedBrief?: string[];
        /** Encuadre inmutable de una visita; no se reutiliza como cámara de otro estado de puertas. */
        propertyVisit?: { id: string; imageId: string; openDoors: boolean; anchorIds: string[]; correctionSourceId?: string };
        review?: import('@/lib/editor-document/render-review').RenderReview;
        fidelity?: import('@/lib/editor-document/render-fidelity').RenderFidelityReport;
        acceptance?: { acceptedAt: string; userId: string };
        /** Metadatos de composiciones anteriores; los nuevos diseños usan una sola imagen auditada. */
        zoneComposite?: { mode: string; coverage: number };
        /** Cubierta del modelo añadida a una vista aceptada (guía de forma del plano y revisión propia). */
        roofClosure?: { baseDeliverableId: string };
        /** Idioma del prompt enviado al generador y el texto exacto cuando se tradujo al inglés. */
        promptLanguage?: 'en';
        sentPrompt?: string;
        /** Por qué se envió en español cuando la traducción no fue utilizable. */
        promptTranslationIssue?: string;
      };
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
