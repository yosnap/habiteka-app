import { z } from 'zod';
import type { JsonSchema } from '@/lib/contracts/chat-vision-adapter';
import { RenderRejectedError } from '@/server/errors/render-rejected-error';
import { UserFacingError } from '@/server/errors/user-facing-error';
import type { RenderSpatialContext } from './render-spatial-context';
import { RENDER_FIDELITY_CRITERIA, type RenderFidelityCriterion, type RenderFidelityReport } from '@/lib/editor-document/render-fidelity';

const check = z.object({ id: z.string().min(1), status: z.enum(['pass', 'fail', 'not-visible']), observation: z.string().trim().min(1) });
const criterionIds = Object.keys(RENDER_FIDELITY_CRITERIA) as [RenderFidelityCriterion, ...RenderFidelityCriterion[]];
const criterion = z.object({ id: z.enum(criterionIds), status: z.enum(['pass', 'fail', 'uncertain']), observation: z.string().trim().min(1) });
const openingCheck = check.extend({
  observedKind: z.enum(['puerta', 'ventana', 'hueco', 'not-visible', 'uncertain']),
  swingClear: z.enum(['clear', 'blocked', 'not-applicable', 'not-visible', 'uncertain']),
});
const constructionCheck = z.object({ status: z.enum(['pass', 'fail', 'uncertain']), observation: z.string().trim().min(1) });
const verdictSchema = z.object({
  accepted: z.boolean(), cameraAndGeometryPreserved: z.boolean(), objectIdentityPreserved: z.boolean(),
  redesignApplied: z.boolean(), roomUsesPreserved: z.boolean(), doorsPhysicallyCoherent: z.boolean(),
  circulationPreserved: z.boolean(), photorealistic: z.boolean(),
  criteria: z.array(criterion), roomChecks: z.array(check), openingChecks: z.array(openingCheck),
  openAreaChecks: z.array(check), constructionCheck, violations: z.array(z.string()),
});
export const RENDER_FIDELITY_SCHEMA = z.toJSONSchema(verdictSchema) as JsonSchema;
export const RENDER_FIDELITY_VERSION = 'spatial-fidelity-v3';

/**
 * Una puntuación global no puede ocultar un fallo concreto o una estancia sin evaluar. En los alzados cortados las
 * puertas del fondo se ven de canto o tapadas: un giro que no se puede comprobar no basta para descartar, uno bloqueado sí.
 * En una sección se sabe qué estancias quedan abiertas (`requiredRoomIds`): declararlas no visibles es perderlas.
 */
export function validateRenderFidelity(value: unknown, redesignRequested: boolean, context?: RenderSpatialContext, model?: string,
  cutawayElevation = false, requiredRoomIds: readonly string[] = []) {
  const parsed = verdictSchema.safeParse(value);
  if (!parsed.success) throw new UserFacingError('No se pudo verificar la fidelidad completa de la imagen. Se ha detenido el lote; vuelve a intentarlo.');
  const verdict = parsed.data;
  const complete = (ids: string[], checks: z.infer<typeof check>[]) =>
    ids.length === checks.length && new Set(checks.map(item => item.id)).size === ids.length
      && checks.every(item => ids.includes(item.id));
  if (verdict.criteria.length !== criterionIds.length || new Set(verdict.criteria.map(item => item.id)).size !== criterionIds.length)
    throw new UserFacingError('La revisión visual no comprobó todos los criterios de calidad. No se puede dar el diseño por verificado.');
  if (context && (!complete(context.levels.flatMap(level => level.rooms.map(room => room.id)), verdict.roomChecks)
    || !complete(context.levels.flatMap(level => level.openings.map(opening => opening.id)), verdict.openingChecks)
    || !complete(context.levels.flatMap(level => (level.openAreas ?? []).map(area => area.id)), verdict.openAreaChecks)))
    throw new UserFacingError('La revisión de la imagen no comprobó todas las estancias y los huecos del plano. El diseño no se ha guardado.');
  // Contrasta observaciones concretas con el modelo aunque el auditor devuelva pass.
  for (const item of verdict.openingChecks) {
    const opening = context?.levels.flatMap(level => level.openings).find(opening => opening.id === item.id);
    if (!opening) continue;
    // Un hueco que el auditor declara no visible se trata como tal aunque marque su giro «no aplicable» (ventanas) o
    // deje otro estado: en las secciones casi todos los huecos quedan fuera y eso no es una incoherencia de la imagen.
    if (item.observedKind === 'not-visible' && (item.swingClear === 'not-visible' || item.swingClear === 'not-applicable')) {
      item.status = 'not-visible'; item.swingClear = 'not-visible';
    }
    let reason: string | undefined;
    if (item.status === 'not-visible') {
      if (item.observedKind !== 'not-visible' || item.swingClear !== 'not-visible')
        reason = 'La visibilidad declarada contradice la observación del hueco.';
    } else if (item.observedKind !== opening.kind) {
      reason = `El plano exige ${opening.kind === 'hueco' ? 'un paso sin puerta' : opening.kind}; la imagen muestra ${item.observedKind}.`;
    } else if (opening.kind === 'puerta' && item.swingClear !== 'clear' && !(cutawayElevation && item.swingClear === 'uncertain')) {
      reason = 'El barrido de la puerta está bloqueado o no se pudo comprobar libre.';
    } else if (opening.kind !== 'puerta' && item.swingClear !== 'not-applicable') {
      reason = 'Se ha declarado un giro de puerta en una ventana o paso sin hoja.';
    }
    if (reason) { item.status = 'fail'; item.observation = `${reason} ${item.observation}`; }
  }
  const failCriterion = (id: RenderFidelityCriterion, evidence: string) => {
    verdict[id] = false;
    const item = verdict.criteria.find(item => item.id === id)!;
    item.status = 'fail'; item.observation = evidence;
  };
  for (const item of verdict.roomChecks) if (item.status === 'not-visible' && requiredRoomIds.includes(item.id)) {
    item.status = 'fail'; item.observation = `La sección debe mostrar esta estancia en su hueco. ${item.observation}`;
  }
  const missingRooms = verdict.roomChecks.filter(item => item.status === 'fail' && requiredRoomIds.includes(item.id));
  if (missingRooms.length) failCriterion('roomUsesPreserved', missingRooms.map(item => `${item.id}: ${item.observation}`).join('; '));
  const openingFailures = verdict.openingChecks.filter(item => item.status === 'fail');
  if (openingFailures.length) failCriterion('doorsPhysicallyCoherent', openingFailures.map(item => `${item.id}: ${item.observation}`).join('; '));
  const circulationFailures = [...openingFailures.filter(item => item.swingClear === 'blocked' || item.swingClear === 'uncertain'),
    ...verdict.openAreaChecks.filter(item => item.status === 'fail')];
  if (circulationFailures.length) failCriterion('circulationPreserved', circulationFailures.map(item => `${item.id}: ${item.observation}`).join('; '));
  if (verdict.constructionCheck.status !== 'pass') failCriterion('cameraAndGeometryPreserved', verdict.constructionCheck.observation);
  const failures = [
    ...(!verdict.cameraAndGeometryPreserved ? ['cámara o geometría alterada'] : []),
    ...(!verdict.roomUsesPreserved ? ['uso de las estancias alterado'] : []),
    ...(!verdict.doorsPhysicallyCoherent ? ['puertas o huecos físicamente incoherentes'] : []),
    ...(!verdict.circulationPreserved ? ['pasos estrechados o bloqueados'] : []),
    ...(!verdict.photorealistic ? ['acabado o detalles sin realismo suficiente'] : []),
    ...(!verdict.objectIdentityPreserved ? ['objetos reconocibles sustituidos'] : []),
    ...(redesignRequested && !verdict.redesignApplied ? ['no se aplicó el rediseño solicitado'] : []),
    ...verdict.criteria.filter(item => item.status !== 'pass').map(item => `${RENDER_FIDELITY_CRITERIA[item.id]}: ${item.observation}`),
    ...[...verdict.roomChecks, ...verdict.openingChecks, ...verdict.openAreaChecks].filter(item => item.status === 'fail').map(item => `${item.id}: ${item.observation}`),
    ...verdict.violations,
  ];
  const rejected = !verdict.accepted || failures.length > 0;
  const report: RenderFidelityReport = { version: RENDER_FIDELITY_VERSION, status: rejected ? 'rejected' : 'passed', checkedAt: new Date().toISOString(), ...(model ? { model } : {}),
    criteria: verdict.criteria.map(item => ({ ...item, status: !verdict[item.id] && (item.id !== 'redesignApplied' || redesignRequested) ? 'fail' : item.status })),
    violations: [...new Set(failures)],
    roomChecks: verdict.roomChecks.map(item => ({ ...item, name: context?.levels.flatMap(level => level.rooms).find(room => room.id === item.id)?.name })),
    openingChecks: verdict.openingChecks.map(item => { const opening = context?.levels.flatMap(level => level.openings).find(value => value.id === item.id);
      return { ...item, name: opening ? `${opening.kind} · ${opening.widthMm} mm` : undefined }; }),
    openAreaChecks: verdict.openAreaChecks.map(item => ({ ...item,
      name: context?.levels.flatMap(level => level.openAreas ?? []).find(area => area.id === item.id)?.names.join(' / ') })),
    constructionCheck: verdict.constructionCheck,
  };
  if (rejected)
    throw new RenderRejectedError(`Se descartó el diseño porque no respeta el plano o el realismo solicitado: ${failures.slice(0, 4).join('; ').slice(0, 600) || 'la revisión visual no lo aprobó'}.`, report);
  return report;
}
