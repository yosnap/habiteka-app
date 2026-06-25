/**
 * Textos legales obligatorios, en un módulo neutral compartible entre cliente y
 * servidor. Son strings puros (sin dependencias de servidor), de modo que la UI
 * puede mostrarlos sin arrastrar código de servidor, y el agente puede inyectar
 * el mismo texto exacto. Fuente única: cambiar la redacción es editar aquí.
 */

/** Aviso mostrado al iniciar el análisis del espacio (fase de ingesta). */
export const INGESTA_DISCLAIMER =
  'El asistente automatizado de Habiteka interpretará los trazos de forma ' +
  'conceptual. Toda propuesta espacial generada requerirá validación por un ' +
  'profesional técnico cualificado del sector.';

/** Sello indeleble estampado en cada entregable. */
export const DELIVERABLE_LEGAL_SEAL =
  '[ Documento conceptual generado por Habiteka AI - Revisión técnica requerida ]';
