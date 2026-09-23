/**
 * Evidencia MEDIBLE de un entregable ya generado, para puntuar el resultado.
 *
 * Funciones puras: ni red ni BD. Nunca viajan imágenes: del render se manda el
 * veredicto TEXTUAL del auditor de visión (`accepted` y sus incumplimientos);
 * de la memoria, qué secciones esperadas aparecen y un extracto recortado; del
 * plano entregado, conteos y banderas. El coste de Jev es por tokens de
 * entrada, así que todo lo que entra está acotado.
 */
import type { Plano2dPayload } from '@/lib/contracts';
import { isDrawablePlanZone } from '@/lib/contracts/plano2d-validation';

/** Veredicto del auditor de visión del render (el que ya produce la entrega). */
export interface RenderAuditVerdict {
  accepted: boolean;
  violations: string[];
}

export interface RenderResultEvidence {
  accepted: boolean;
  violations: string[];
  violationCount: number;
  /** El render se auditó contra un contrato estructural explícito. */
  hadContract: boolean;
}

/** Máximo de incumplimientos y de caracteres por incumplimiento que se mandan. */
const MAX_VIOLATIONS = 8;
const MAX_VIOLATION_CHARS = 200;

export function buildRenderResultEvidence(
  verdict: RenderAuditVerdict,
  hadContract: boolean,
): RenderResultEvidence {
  const violations = verdict.violations
    .slice(0, MAX_VIOLATIONS)
    .map((item) => item.slice(0, MAX_VIOLATION_CHARS));
  return {
    accepted: verdict.accepted,
    violations,
    violationCount: verdict.violations.length,
    hadContract,
  };
}

/** Secciones que una memoria de materiales debe cubrir siempre. */
export const MEMORIA_SECTIONS = {
  suelo: /suelo|pavimento|solad/iu,
  paredes: /pared|revestimiento|techo/iu,
  iluminacion: /iluminaci|luminari|lámpara|lampara/iu,
  textiles: /textil|tejido|cortin|tapicer/iu,
  paleta: /paleta|color|cromát|cromat/iu,
} as const;

/** Extracto de la memoria que viaja a Jev (el markdown completo puede ser largo). */
const MAX_MEMORIA_CHARS = 4000;

export interface MemoriaResultEvidence {
  estilo: string;
  objetivo: string;
  /** Secciones esperadas presentes/ausentes, por nombre. */
  sections: Record<string, boolean>;
  missingSections: string[];
  chars: number;
  words: number;
  /** Texto recortado de la memoria; sin imágenes ni datos del sistema. */
  excerpt: string;
}

export function buildMemoriaResultEvidence(
  markdown: string,
  context: { estilo: string; objetivo: string },
): MemoriaResultEvidence {
  const text = typeof markdown === 'string' ? markdown : '';
  const sections = Object.fromEntries(
    Object.entries(MEMORIA_SECTIONS).map(([name, pattern]) => [name, pattern.test(text)]),
  );
  return {
    estilo: context.estilo.slice(0, 80),
    objetivo: context.objetivo.slice(0, 200),
    sections,
    missingSections: Object.entries(sections)
      .filter(([, present]) => !present)
      .map(([name]) => name),
    chars: text.length,
    words: text.split(/\s+/u).filter(Boolean).length,
    excerpt: text.slice(0, MAX_MEMORIA_CHARS),
  };
}

export interface PlanResultEvidence {
  zonas: number;
  zonasDibujables: number;
  muros: number;
  huecos: number;
  huecosSinMuro: number;
  cotas: number;
  zonasSinNombre: number;
  zonasSinContorno: number;
  /** El plano viaja marcado como orientativo (no procede de una planta real). */
  aproximado: boolean;
}

export function buildPlanResultEvidence(plano: Plano2dPayload): PlanResultEvidence {
  const zones = plano.zones ?? [];
  const walls = zones.flatMap((zone) => zone.walls ?? []);
  const wallIds = new Set(walls.map((wall) => wall.id));
  const apertures = zones.flatMap((zone) => zone.apertures ?? []);
  return {
    zonas: zones.length,
    zonasDibujables: zones.filter(isDrawablePlanZone).length,
    muros: walls.length,
    huecos: apertures.length,
    huecosSinMuro: apertures.filter((aperture) => !wallIds.has(aperture.wallId)).length,
    cotas: zones.reduce((total, zone) => total + (zone.dimensions?.length ?? 0), 0),
    zonasSinNombre: zones.filter((zone) => !zone.name?.trim()).length,
    zonasSinContorno: zones.filter((zone) => (zone.outline?.length ?? 0) < 3).length,
    aproximado: plano.aproximado === true,
  };
}
