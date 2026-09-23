/**
 * Contrato compartido de los puntos de control de calidad.
 *
 * Vive aparte del registro (`checkpoints.ts`) para que cada familia de puntos de
 * control pueda declararse en su propio fichero sin importar el registro y sin
 * crear un ciclo de módulos.
 */
import type { JevAnswer, JevQuestion } from './jev-client';

export interface CheckpointQuestion<E> {
  /** Peso relativo en el score (se normaliza sobre la suma de pesos presentes). */
  weight: number;
  /** Motivo en español de España que se muestra si esta pregunta puntúa bajo. */
  reason: string;
  /**
   * Versión en tono de duda, para cuando la respuesta no llega a fallo pero es
   * lo que más resta. Sin ella se usa `reason` precedido de «Posible problema».
   */
  doubt?: string;
  /** Construye la pregunta a partir de la evidencia. */
  build: (evidence: E) => JevQuestion;
  /**
   * Si devuelve false, la pregunta no se hace ni pesa: no se penaliza lo que no se
   * puede medir (p. ej. cotas en un plano que no tiene ninguna escrita).
   */
  applies?: (evidence: E) => boolean;
  /**
   * Normaliza la respuesta a 0–1. Por defecto: `score` sobre sus niveles y
   * `noul` como probabilidad. Las preguntas `choice` deben aportarla.
   */
  value?: (answer: JevAnswer, question: JevQuestion) => number | null;
}

export interface CheckpointDefinition<E> {
  id: string;
  /** Texto/JSON que se manda como `state` a Jev. */
  buildState: (evidence: E) => string;
  questions: Record<string, CheckpointQuestion<E>>;
  /**
   * Hechos medidos en la evidencia que explican al usuario final POR QUÉ la
   * fiabilidad no es alta (p. ej. «3 extremos de muro sin unir»).
   */
  explain?: (evidence: E) => string[];
}

/** Normaliza un `score` (1..n) al intervalo 0–1 usando los niveles declarados. */
export function scoreToUnit(answer: JevAnswer, question: JevQuestion): number | null {
  if (typeof answer.score !== 'number') return null;
  const levels = question.type === 'score' ? question.criteria.length : 0;
  if (levels < 2) return null;
  // Jev puntúa en base 0: su leyenda va de «0» a «niveles − 1».
  const clamped = Math.min(Math.max(answer.score, 0), levels - 1);
  return clamped / (levels - 1);
}

/** Normaliza un `noul` (probabilidad 0–1) al intervalo 0–1. */
export function noulToUnit(answer: JevAnswer): number | null {
  if (typeof answer.noul !== 'number' || !Number.isFinite(answer.noul)) return null;
  return Math.min(Math.max(answer.noul, 0), 1);
}

/** Construye la normalización de una pregunta `choice` desde un mapa opción→valor. */
export function choiceToUnit(values: Record<string, number>) {
  return (answer: JevAnswer): number | null => {
    if (typeof answer.choice !== 'string') return null;
    const value = values[answer.choice];
    return typeof value === 'number' ? Math.min(Math.max(value, 0), 1) : null;
  };
}
