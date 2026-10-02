/**
 * Registro de puntos de control de calidad.
 *
 * Un punto de control declara, en un único sitio: qué evidencia se le manda a
 * Jev, qué preguntas atómicas (en inglés, como pide el modelo) se hacen, cuánto
 * pesa cada una en el score final y qué motivo en español ve el usuario cuando
 * esa pregunta puntúa bajo. Añadir un punto de control nuevo es añadir una
 * entrada aquí; ni el evaluador ni las puertas cambian.
 */
import type { CheckpointDefinition } from './checkpoint-kit';
import { choiceToUnit } from './checkpoint-kit';
import type { PlanEvidence } from './evidence/plan-evidence';
import { explainEditorEvidence, type EditorEvidence } from './evidence/editor-evidence';
import { CHANGE_INSTRUCTION } from './checkpoints-instruction';
import { MEMORIA_RESULT, PLAN_RESULT, RENDER_RESULT } from './checkpoints-results';
import { VIDEO_KEYFRAMES } from './checkpoints-video';

export type { CheckpointDefinition, CheckpointQuestion } from './checkpoint-kit';
export { choiceToUnit, noulToUnit, scoreToUnit } from './checkpoint-kit';

/** Evidencia del punto de control de ejemplo: una petición del usuario ya resumida. */
export interface PeticionEvidence {
  descripcion: string;
  superficieM2?: number;
  estancias?: number;
}

/**
 * Punto de control mínimo: ¿la petición del usuario es lo bastante concreta y
 * coherente para trabajar sobre ella? Sirve de ejemplo del contrato y lo usan
 * las pruebas; los puntos de control reales del plano llegan en la fase 2.
 */
export const PETICION_MINIMA: CheckpointDefinition<PeticionEvidence> = {
  id: 'peticion_minima',
  buildState: (evidence) => JSON.stringify(evidence),
  questions: {
    completeness: {
      weight: 2,
      reason: 'La petición no aporta datos suficientes para trabajar sobre ella.',
      build: () => ({
        type: 'score',
        instructions:
          'How complete is this home renovation request for starting design work?',
        criteria: [
          'Unusable: almost no usable information',
          'Poor: key data such as surface or rooms is missing',
          'Acceptable: enough data, with minor gaps',
          'Complete: all the data needed is present',
        ],
      }),
    },
    consistency: {
      weight: 1,
      reason: 'Los datos de la petición se contradicen entre sí.',
      build: () => ({
        type: 'noul',
        instructions:
          'The numeric data in this request is internally consistent (surface, rooms and description agree).',
      }),
    },
  },
};

/**
 * Fidelidad de la lectura de un plano dibujado. La evidencia la construye
 * `buildPlanEvidence`: conteos de muros (píxeles vs modelo vs plano), zonas
 * cerradas, desviación de las cotas escritas, avisos y geometría rota. Decide
 * si el plano se usa tal cual, se confirma o se manda a corregir al editor.
 */
export const PLAN_EXTRACTION: CheckpointDefinition<PlanEvidence> = {
  id: 'plan_extraction',
  // Las notas evitan que Jev compare magnitudes que no son comparables.
  buildState: (evidence) =>
    JSON.stringify({
      evidence,
      notes: [
        '`evidence.murosRaster` counts pixel stroke fragments, not logical walls: never compare it with `murosModelo` or `murosPlano`.',
        evidence.cotasEscritas === 0
          ? 'The drawing has no written dimensions, so an estimated scale is expected and is not an error.'
          : '`desviacionCotasPct` is the residual deviation between written and computed dimensions.',
      ],
    }),
  questions: {
    fidelity: {
      weight: 3,
      reason: 'La lectura del plano no reproduce con fidelidad la imagen original.',
      build: () => ({
        type: 'score',
        instructions:
          'Judging only by `evidence`, how usable is this extracted floor plan as the basis of an editable plan?',
        criteria: [
          'Unusable: rooms are missing or the plan cannot be drawn',
          'Poor: several rooms are open or broken',
          'Doubtful: recognisable, with some structural defects',
          'Good: every room is drawable with minor issues',
          'Faithful: every room is drawable and no defect is reported',
        ],
      }),
    },
    rooms_closed: {
      weight: 3,
      reason: 'Alguna estancia no ha quedado cerrada: faltan muros o el contorno está roto.',
      build: () => ({
        type: 'noul',
        instructions:
          'Every zone is drawable: `evidence.zonasDibujables` equals `evidence.zonas` and `evidence.planoDibujable` is true.',
      }),
    },
    structure_sound: {
      weight: 2,
      reason: 'Hay huecos fuera de su muro o muros degenerados en la lectura.',
      build: () => ({
        type: 'noul',
        instructions:
          'The structure is sound: `evidence.huecosSinMuro` and `evidence.murosDegenerados` are zero or negligible.',
      }),
    },
    dimensions_match: {
      weight: 2,
      reason: 'Las medidas calculadas no cuadran con las cotas escritas en el plano.',
      // Sin cotas escritas no hay nada que comparar: la pregunta no se hace.
      applies: (evidence) => evidence.cotasEscritas > 0,
      build: () => ({
        type: 'noul',
        instructions:
          'Written dimensions match computed ones: `evidence.desviacionCotasPct.max` is below about 10.',
      }),
    },
    main_issue: {
      weight: 1,
      reason: 'Hay un problema dominante en la lectura del plano.',
      build: () => ({
        type: 'choice',
        instructions: 'What is the main defect in this extraction, according to `evidence`?',
        criteria: {
          none: 'No relevant defect is reported',
          scale: 'Written dimensions contradict the computed ones (an estimated scale alone is not a defect)',
          walls: 'Walls are degenerate or missing',
          openings: 'Doors and windows are not anchored to a wall',
          rooms: 'Rooms are missing, open or not drawable',
        },
      }),
      value: choiceToUnit({ none: 1, openings: 0.6, scale: 0.4, rooms: 0.3, walls: 0.2 }),
    },
  },
};

/**
 * Salud estructural del documento del editor antes de una generación de pago.
 * La evidencia la construye `buildEditorEvidence`: estancias cerradas, topología
 * planar, huecos apoyados en muro, escala conocida y coherencia de plataformas,
 * escaleras y rampas. Decide si se genera, se confirma o no se gasta nada.
 */
export const EDITOR_STRUCTURE: CheckpointDefinition<EditorEvidence> = {
  id: 'editor_structure',
  buildState: (evidence) => JSON.stringify(evidence),
  explain: explainEditorEvidence,
  questions: {
    geometry_sound: {
      weight: 3,
      reason: 'La geometría del plano tiene fallos estructurales: muros sin unir, cruces sin vértice o contornos rotos.',
      doubt: 'La geometría tiene algunos defectos menores que pueden deformar la imagen.',
      build: () => ({
        type: 'score',
        instructions:
          'How structurally sound is this floor plan for generating a photorealistic image of the space, judging only by the measured evidence? pasosAbiertos are intentional doorless passages, not defects.',
        criteria: [
          'Unusable: the geometry is broken and cannot describe a real space',
          'Poor: major structural defects across the plan',
          'Doubtful: the plan works but several defects remain',
          'Good: minor defects only',
          'Sound: no structural defect in the evidence',
        ],
      }),
    },
    rooms_closed: {
      weight: 2,
      reason: 'Hay estancias sin cerrar: los muros no forman recintos completos.',
      doubt: 'Puede que alguna estancia no quede del todo cerrada por muros.',
      build: () => ({
        type: 'noul',
        instructions: 'Rooms are closed: the walls enclose complete rooms and the plan has no broken outline. Intentional doorless passages (pasosAbiertos) may join two spaces and are not a broken outline.',
      }),
    },
    openings_anchored: {
      weight: 2,
      reason: 'Hay puertas o ventanas que no se apoyan correctamente en un muro.',
      doubt: 'Puede que alguna puerta o ventana no encaje bien en su muro.',
      build: () => ({
        type: 'noul',
        instructions: 'Every door and window sits on an existing wall and fits inside it.',
      }),
    },
    scale_known: {
      weight: 2,
      reason: 'La escala del plano no está definida: las medidas no son fiables.',
      doubt: 'Las medidas pueden no ser exactas: parte del plano se midió sobre la imagen.',
      build: () => ({
        type: 'noul',
        instructions: 'The plan has a known scale: its measurements are physical, not guessed from an image.',
      }),
    },
    levels_coherent: {
      weight: 1,
      reason: 'Las cotas de plataformas, escaleras o rampas no son coherentes entre sí.',
      doubt: 'Las alturas de plataformas, escaleras o rampas podrían no cuadrar entre sí.',
      build: () => ({
        type: 'noul',
        instructions: 'Raised floors, stairs and ramps are dimensionally coherent with each other.',
      }),
    },
    main_issue: {
      weight: 1,
      reason: 'Hay un problema dominante en la estructura del plano.',
      build: () => ({
        type: 'choice',
        instructions: 'What is the main structural problem of this floor plan?',
        criteria: {
          none: 'No relevant problem',
          scale: 'The scale is unknown or guessed',
          walls: 'Walls are degenerate, unjoined or crossing without a shared vertex',
          openings: 'Doors and windows are unanchored or do not fit their wall',
          rooms: 'Rooms are open, missing or cannot be derived',
          levels: 'Raised floors, stairs or ramps are incoherent',
        },
      }),
      value: choiceToUnit({ none: 1, openings: 0.6, levels: 0.5, scale: 0.4, rooms: 0.3, walls: 0.2 }),
    },
  },
};

const REGISTRY = {
  [PETICION_MINIMA.id]: PETICION_MINIMA,
  [PLAN_EXTRACTION.id]: PLAN_EXTRACTION,
  [EDITOR_STRUCTURE.id]: EDITOR_STRUCTURE,
  [CHANGE_INSTRUCTION.id]: CHANGE_INSTRUCTION,
  [RENDER_RESULT.id]: RENDER_RESULT,
  [MEMORIA_RESULT.id]: MEMORIA_RESULT,
  [PLAN_RESULT.id]: PLAN_RESULT,
  [VIDEO_KEYFRAMES.id]: VIDEO_KEYFRAMES,
} satisfies Record<string, CheckpointDefinition<never>>;

export type CheckpointId = keyof typeof REGISTRY;

/** Devuelve la definición de un punto de control o `null` si no existe. */
export function getCheckpoint(id: string): CheckpointDefinition<never> | null {
  return (REGISTRY as Record<string, CheckpointDefinition<never>>)[id] ?? null;
}

/** Ids registrados, para el panel de admin y las pruebas. */
export function checkpointIds(): string[] {
  return Object.keys(REGISTRY);
}
