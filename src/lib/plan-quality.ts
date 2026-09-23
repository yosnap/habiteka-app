/**
 * Traducción del veredicto de calidad al contrato del plano que ve el usuario.
 *
 * Regla única (la usan el agente y cualquier futuro consumidor): solo un plano
 * que Jev da por bueno se entrega como fiel; con dudas, bloqueo o sin poder
 * evaluar, el plano viaja marcado como `aproximado` con sus motivos, para que
 * nada aguas abajo lo presente como la planta real del espacio.
 *
 * Vive en `lib` (sin dependencias de servidor) porque la usan tanto el agente en
 * el servidor como el paso «Revisa tu plano» del asistente, que es cliente.
 */
import type { Plano2dPayload } from '@/lib/contracts';
import type { QualityVerdict } from '@/lib/quality-verdict';

export function applyPlanQuality(
  plano: Plano2dPayload,
  evaluation: Pick<QualityVerdict, 'score' | 'decision' | 'reasons'>,
): Plano2dPayload {
  return {
    ...plano,
    ...(evaluation.decision === 'proceed' ? {} : { aproximado: true }),
    calidad: {
      score: evaluation.score,
      decision: evaluation.decision,
      motivos: evaluation.reasons,
    },
  };
}
