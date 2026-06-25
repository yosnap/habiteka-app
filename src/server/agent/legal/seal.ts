/**
 * Re-exporta los textos legales obligatorios desde el módulo neutral compartido,
 * para que el agente los inyecte server-side sin duplicar la redacción. La fuente
 * única vive en `@/lib/legal-text` (string puro, usable también desde la UI).
 */
export { INGESTA_DISCLAIMER, DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';
