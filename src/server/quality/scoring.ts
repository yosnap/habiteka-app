/**
 * Núcleo puro de la evaluación de calidad: combinar respuestas de Jev en un
 * score 0–100 y traducirlo a una decisión por bandas. Sin BD ni red, para que
 * la regla que decide si se gasta dinero sea comprobable en aislamiento.
 */
import type { CheckpointDefinition } from './checkpoints';
import { noulToUnit, scoreToUnit } from './checkpoints';
import type { JevAnswer, JevQuestion } from './jev-client';

export type QualityDecision = 'proceed' | 'confirm' | 'block';

export interface QualityThresholds {
  proceed: number;
  confirm: number;
}

export const DEFAULT_THRESHOLDS: QualityThresholds = { proceed: 85, confirm: 60 };

/** Por debajo de este valor normalizado, la pregunta aporta su motivo al usuario. */
// Solo se muestra un motivo cuando la respuesta se inclina por el «no»; una duda no es un fallo.
const REASON_THRESHOLD = 0.5;
/** Sin fallos claros, las respuestas por debajo de esto explican por qué no es alta. */
const DOUBT_THRESHOLD = 0.9;
const MAX_DOUBTS = 2;

export interface CombinedScore {
  /** `null` si ninguna respuesta era utilizable. */
  score: number | null;
  confidence: number | null;
  reasons: string[];
}

/**
 * Combina las respuestas con los pesos del punto de control. Las preguntas sin
 * respuesta utilizable se ignoran y su peso no cuenta, de modo que una respuesta
 * parcial no hunde ni infla el resultado.
 */
export function combineAnswers<E>(
  definition: CheckpointDefinition<E>,
  questions: Record<string, JevQuestion>,
  answers: Record<string, JevAnswer>,
): CombinedScore {
  let weighted = 0;
  let totalWeight = 0;
  const confidences: number[] = [];
  const reasons: string[] = [];
  const doubts: Array<{ unit: number; text: string }> = [];

  for (const [id, spec] of Object.entries(definition.questions)) {
    const question = questions[id];
    const answer = answers[id];
    if (!question || !answer) continue;
    const unit = normalize(spec.value, answer, question);
    if (unit === null) continue;
    weighted += unit * spec.weight;
    totalWeight += spec.weight;
    if (typeof answer.confidence === 'number' && Number.isFinite(answer.confidence)) {
      confidences.push(Math.min(Math.max(answer.confidence, 0), 1));
    }
    if (unit < REASON_THRESHOLD) reasons.push(spec.reason);
    else if (unit < DOUBT_THRESHOLD) doubts.push({ unit, text: spec.doubt ?? `Posible problema: ${lowerFirst(spec.reason)}` });
  }
  // Un 82 % sin ningún «no» claro también merece un porqué: lo que más resta.
  if (!reasons.length)
    reasons.push(...doubts.sort((a, b) => a.unit - b.unit).slice(0, MAX_DOUBTS).map((doubt) => doubt.text));

  if (totalWeight === 0) return { score: null, confidence: null, reasons: [] };
  return {
    score: Math.round((weighted / totalWeight) * 100),
    confidence: confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : null,
    reasons,
  };
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function normalize(
  custom: ((answer: JevAnswer, question: JevQuestion) => number | null) | undefined,
  answer: JevAnswer,
  question: JevQuestion,
): number | null {
  if (custom) return custom(answer, question);
  if (question.type === 'score') return scoreToUnit(answer, question);
  if (question.type === 'noul') return noulToUnit(answer);
  return null;
}

/** Traduce un score 0–100 a la decisión de la banda correspondiente. */
export function decide(score: number, thresholds: QualityThresholds): QualityDecision {
  if (score >= thresholds.proceed) return 'proceed';
  if (score >= thresholds.confirm) return 'confirm';
  return 'block';
}

/** Lee unos umbrales desde un valor arbitrario (ajuste de sistema) o usa los de serie. */
export function parseThresholds(value: unknown): QualityThresholds {
  const raw = value as { proceed?: unknown; confirm?: unknown } | null;
  const proceed = raw?.proceed;
  const confirm = raw?.confirm;
  if (!isBandValue(proceed) || !isBandValue(confirm) || confirm >= proceed) {
    return DEFAULT_THRESHOLDS;
  }
  return { proceed, confirm };
}

function isBandValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}
