/**
 * Textos legales obligatorios e indelebles (fuente única).
 *
 * El disclaimer de ingesta y el sello de los entregables NO los genera el modelo:
 * los inyecta el servidor desde aquí, de modo que su presencia y su texto exacto
 * no dependen de que la IA obedezca. Cambiar la redacción es editar este punto.
 */

/** Aviso mostrado al iniciar el análisis del espacio (fase de ingesta). */
export const INGESTA_DISCLAIMER =
  'El asistente automatizado de Habiteka interpretará los trazos de forma ' +
  'conceptual. Toda propuesta espacial generada requerirá validación por un ' +
  'profesional técnico cualificado del sector.';

/** Sello indeleble estampado en cada entregable. */
export const DELIVERABLE_LEGAL_SEAL =
  '[ Documento conceptual generado por Habiteka AI - Revisión técnica requerida ]';
