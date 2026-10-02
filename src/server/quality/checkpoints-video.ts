/**
 * Punto de control previo al vídeo con IA entre imágenes: ¿el conjunto de fotogramas clave es homogéneo?
 *
 * Jev no mira las imágenes: puntúa la evidencia medida (procedencia, luz, fidelidad y cobertura). Decide si se
 * puede animar (`proceed`), si conviene revisar antes (`confirm`) o si hay que regenerar (`block`).
 */
import type { CheckpointDefinition } from './checkpoint-kit';
import { choiceToUnit } from './checkpoint-kit';
import { explainKeyframeSet, type KeyframeSetEvidence } from './evidence/keyframe-set-evidence';

export const VIDEO_KEYFRAMES_CHECKPOINT = 'video_keyframes';

export const VIDEO_KEYFRAMES: CheckpointDefinition<KeyframeSetEvidence> = {
  id: VIDEO_KEYFRAMES_CHECKPOINT,
  buildState: (evidence) => JSON.stringify(evidence),
  explain: explainKeyframeSet,
  questions: {
    same_design: {
      weight: 4,
      reason: 'Hay imágenes que no proceden del diseño aprobado y mostrarían estancias o muebles distintos.',
      build: () => ({
        type: 'noul',
        instructions: 'Every image in the set comes from the approved design (fromApprovedDesign equals imageCount).',
      }),
    },
    same_light: {
      weight: 2,
      reason: 'Las imágenes tienen luces distintas y el vídeo saltaría de un momento del día a otro.',
      build: () => ({
        type: 'noul',
        instructions: 'All images share one single lighting condition (the lightings list has exactly one entry).',
      }),
    },
    same_fidelity: {
      weight: 3,
      reason: 'Se mezclan niveles de libertad o permisos de rediseño de fijos distintos.',
      build: () => ({
        type: 'noul',
        instructions: 'All images share one single decoration freedom level (freedoms has exactly one entry) AND one fixed furniture redesign permission (fixedDesignModes has exactly one entry). Mixing redesigned kitchens or fixtures with preserved fixtures is inconsistent.',
      }),
    },
    coverage: {
      weight: 2,
      reason: 'Faltan ámbitos del inmueble sin ninguna imagen.',
      build: () => ({
        type: 'score',
        instructions: 'How completely does the set cover the property, given missingAmbients versus the ambients present?',
        criteria: [
          'Unusable: most expected ambients have no image',
          'Poor: several expected ambients have no image',
          'Acceptable: one expected ambient has no image',
          'Complete: every expected ambient has at least one image',
        ],
      }),
    },
    verdict: {
      weight: 2,
      reason: 'El conjunto no está listo para animarse tal cual.',
      build: () => ({
        type: 'choice',
        instructions: 'Given all the evidence, what should be done before generating video between these images?',
        criteria: {
          animate: 'The set is homogeneous and ready to animate',
          review: 'Minor inconsistencies; a person should review before animating',
          regenerate: 'Major inconsistencies; regenerate the images first',
        },
      }),
      value: choiceToUnit({ animate: 1, review: 0.5, regenerate: 0 }),
    },
  },
};
