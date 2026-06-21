/**
 * Elemento detectado por la IA al analizar una foto/boceto (F5, puente foto→plano).
 *
 * La IA propone elementos con su posición (bounding box NORMALIZADA 0–1 respecto
 * al alto/ancho de la imagen) para poblar el plano como objetos editables. La bbox
 * es normalizada para mapearla a cualquier tamaño de stage sin acoplarse a píxeles.
 */
import type { StructKind } from '@/canvas/types';

export interface NormalizedBox {
  /** Esquina superior izquierda, 0–1. */
  x: number;
  y: number;
  /** Ancho y alto, 0–1. */
  w: number;
  h: number;
}

export interface DetectedObject {
  /** Tipo del catálogo (validado contra el catálogo en el servidor). */
  kind: StructKind;
  /** Posición y tamaño normalizados (0–1) respecto a la imagen. */
  bbox: NormalizedBox;
  /** Confianza 0–1 si el modelo la aporta (opcional). */
  confianza?: number;
}
