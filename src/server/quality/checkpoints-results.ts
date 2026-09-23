/**
 * Puntos de control POSTERIORES a la generación: puntúan el resultado ya
 * entregado (y ya cobrado). No bloquean la entrega: registran la calidad para
 * enseñarla en «Diseños» y alimentar el panel de eficacia.
 */
import type { CheckpointDefinition } from './checkpoint-kit';
import { choiceToUnit } from './checkpoint-kit';
import type {
  MemoriaResultEvidence,
  PlanResultEvidence,
  RenderResultEvidence,
} from './evidence/result-evidence';

export const RENDER_RESULT_CHECKPOINT = 'render_result';
export const MEMORIA_RESULT_CHECKPOINT = 'memoria_result';
export const PLAN_RESULT_CHECKPOINT = 'plan_result';

/**
 * Calidad del render entregado, juzgada sobre el veredicto TEXTUAL del auditor
 * de visión: Jev no mira la imagen, puntúa lo que el auditor dijo de ella.
 */
export const RENDER_RESULT: CheckpointDefinition<RenderResultEvidence> = {
  id: RENDER_RESULT_CHECKPOINT,
  buildState: (evidence) => JSON.stringify(evidence),
  questions: {
    fidelity: {
      weight: 3,
      reason: 'El render se aparta del plano en detalles que el auditor ha señalado.',
      build: () => ({
        type: 'score',
        instructions:
          'How faithful is this render to its floor plan, judging only by the vision auditor verdict?',
        criteria: [
          'Unusable: the auditor rejected it with structural violations',
          'Poor: several violations affect the layout',
          'Doubtful: minor violations remain',
          'Good: the auditor accepted it with remarks',
          'Faithful: accepted with no remark',
        ],
      }),
    },
    accepted: {
      weight: 3,
      reason: 'El auditor de visión no dio el render por válido.',
      build: () => ({
        type: 'noul',
        instructions: 'The vision auditor accepted the render.',
      }),
    },
    clean: {
      weight: 2,
      reason: 'El render muestra texto, cotas o etiquetas que no deberían aparecer.',
      build: () => ({
        type: 'noul',
        instructions: 'No violation mentions visible text, IDs, dimensions or labels in the image.',
      }),
    },
    main_issue: {
      weight: 1,
      reason: 'Hay un problema dominante en el render entregado.',
      build: () => ({
        type: 'choice',
        instructions: 'What is the main problem reported about this render?',
        criteria: {
          none: 'No relevant problem',
          text: 'Visible text, labels or dimensions',
          layout: 'Elements moved, duplicated or missing',
          levels: 'Raised floors, stairs or ramps are wrong',
          style: 'Only aesthetic remarks',
        },
      }),
      value: choiceToUnit({ none: 1, style: 0.8, text: 0.5, levels: 0.3, layout: 0.2 }),
    },
  },
};

/** Calidad de la memoria de materiales entregada (texto, no imagen). */
export const MEMORIA_RESULT: CheckpointDefinition<MemoriaResultEvidence> = {
  id: MEMORIA_RESULT_CHECKPOINT,
  buildState: (evidence) => JSON.stringify(evidence),
  questions: {
    completeness: {
      weight: 3,
      reason: 'La memoria deja fuera secciones que se esperan (suelo, paredes y techo, iluminación, textiles o paleta).',
      build: () => ({
        type: 'score',
        instructions:
          'How complete is this materials report, given which expected sections are present?',
        criteria: [
          'Unusable: almost every expected section is missing',
          'Poor: several expected sections are missing',
          'Acceptable: one expected section is missing',
          'Complete: every expected section is covered',
        ],
      }),
    },
    coherent: {
      weight: 3,
      reason: 'La memoria no encaja con el estilo elegido ni con el objetivo de la reforma.',
      build: () => ({
        type: 'noul',
        instructions: 'The materials described are coherent with the requested style and goal.',
      }),
    },
    length_ok: {
      weight: 2,
      reason: 'La extensión de la memoria no es razonable: se queda corta o se va por las ramas.',
      build: () => ({
        type: 'noul',
        instructions: 'The length of the report is reasonable for a materials report: neither a stub nor padded filler.',
      }),
    },
    actionable: {
      weight: 2,
      reason: 'La memoria no concreta materiales ni acabados utilizables.',
      build: () => ({
        type: 'noul',
        instructions: 'The report names concrete materials and finishes, not generic advice.',
      }),
    },
  },
};

/** Calidad del plano 2D entregado, sobre conteos y banderas del propio plano. */
export const PLAN_RESULT: CheckpointDefinition<PlanResultEvidence> = {
  id: PLAN_RESULT_CHECKPOINT,
  buildState: (evidence) => JSON.stringify(evidence),
  questions: {
    usable: {
      weight: 3,
      reason: 'El plano entregado no es utilizable tal cual.',
      build: () => ({
        type: 'score',
        instructions:
          'How usable is this delivered floor plan, judging only by the measured evidence?',
        criteria: [
          'Unusable: there is nothing drawable',
          'Poor: most rooms lack outline or walls',
          'Doubtful: it is drawable but incomplete',
          'Good: minor gaps only',
          'Usable: complete and consistent',
        ],
      }),
    },
    rooms_drawable: {
      weight: 2,
      reason: 'Alguna estancia del plano no tiene contorno ni muros que dibujar.',
      build: () => ({
        type: 'noul',
        instructions: 'Every zone is drawable: it has an outline and walls.',
      }),
    },
    openings_anchored: {
      weight: 2,
      reason: 'Hay puertas o ventanas que no se apoyan en un muro del plano.',
      build: () => ({
        type: 'noul',
        instructions: 'Every door and window references an existing wall.',
      }),
    },
    labelled: {
      weight: 1,
      reason: 'Al plano le faltan nombres de estancia o cotas.',
      build: () => ({
        type: 'noul',
        instructions: 'Rooms are named and the plan carries dimensions.',
      }),
    },
  },
};
