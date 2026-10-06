import { z } from 'zod';
import { FIXTURE_KINDS, FIXTURE_LABELS, type CriticalFixtureGroup } from '@/lib/editor-document/critical-fixtures';

const count = z.number().int().min(0).nullable();
const counts = z.object({ toilet: count, washbasin: count, bidet: count, bath: count,
  shower: count, 'kitchen-sink': count, cooktop: count });
export const fixtureCheckSchema = z.object({ id: z.string().min(1), status: z.enum(['pass', 'fail', 'not-visible']),
  observation: z.string().trim().min(1), referenceCounts: counts, observedCounts: counts,
  identityAndPlacement: z.enum(['preserved', 'changed', 'not-visible', 'uncertain']) });
export type FixtureCheck = z.infer<typeof fixtureCheckSchema>;
export interface FixtureAuditPolicy { fullPlan?: boolean; acceptedDesign?: boolean; redesignFixed?: boolean }

/** Contrasta cantidades reales, sin imponer los muebles del plano a un diseño aceptado distinto. */
export function validateFixtureChecks(checks: FixtureCheck[], groups: CriticalFixtureGroup[], policy: FixtureAuditPolicy) {
  for (const check of checks) {
    const expected = groups.find(group => group.id === check.id);
    if (!expected) continue;
    const hidden = check.identityAndPlacement === 'not-visible';
    if (hidden && !policy.fullPlan && FIXTURE_KINDS.every(kind => check.observedCounts[kind] === null)) {
      check.status = 'not-visible'; continue;
    }
    const reasons: string[] = [];
    if (hidden || check.status === 'not-visible') reasons.push('Los sanitarios o la placa deben verse en esta referencia.');
    if (check.identityAndPlacement !== 'preserved') reasons.push('Función o ubicación de sanitarios/placa alterada o no verificable.');
    for (const kind of FIXTURE_KINDS) {
      // Con rediseño de fijos una bañera puede pasar a ducha: el total de ambas no se multiplica.
      if (policy.redesignFixed && (kind === 'bath' || kind === 'shower')) continue;
      const observed = check.observedCounts[kind], reference = check.referenceCounts[kind];
      const required = policy.fullPlan && !policy.acceptedDesign ? expected.counts[kind] : reference;
      if (required === null || observed === null || observed !== required
        || (!policy.acceptedDesign && (reference === null || reference > expected.counts[kind] || observed > expected.counts[kind])))
        reasons.push(`${FIXTURE_LABELS[kind]}: se esperaban ${required ?? 'piezas verificables'} y se observan ${observed ?? 'piezas no verificables'}.`);
    }
    if (policy.redesignFixed) {
      const observed = check.observedCounts.bath === null || check.observedCounts.shower === null ? null
        : check.observedCounts.bath + check.observedCounts.shower;
      const reference = check.referenceCounts.bath === null || check.referenceCounts.shower === null ? null
        : check.referenceCounts.bath + check.referenceCounts.shower;
      const required = policy.fullPlan && !policy.acceptedDesign ? expected.counts.bath + expected.counts.shower : reference;
      if (observed === null || required === null || observed !== required)
        reasons.push('El número de bañeras y duchas no coincide con la referencia.');
    }
    if (reasons.length) { check.status = 'fail'; check.observation = `${reasons.join(' ')} ${check.observation}`; }
  }
}
