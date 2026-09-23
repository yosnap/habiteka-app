/**
 * Exportación del panel de eficacia en CSV: el informe agregado (no el detalle
 * fila a fila, que ya exporta `/api/admin/ai-costs/export`). Tres bloques en un
 * mismo fichero: puntos de control, reparto del gasto, ahorro estimado
 * (bloqueos que cortaron gasto), bloqueos informativos y proveedores.
 *
 * El informe ya llega agregado por la base de datos: exportarlo no depende del
 * número de evaluaciones del rango.
 */
import { csvRow } from '@/lib/ai-cost-csv';
import { checkpointKind, checkpointLabel } from '@/lib/quality-checkpoint-labels';
import { ForbiddenAdminError, requireAdmin } from '@/server/admin/guard';
import { qualityFilterParams } from '@/server/admin/analytics/quality-filter-params';
import { queryQualityEfficacy } from '@/server/admin/analytics/quality-queries';

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof ForbiddenAdminError) return new Response('Acceso restringido', { status: 403 });
    throw error;
  }
  const filters = qualityFilterParams(new URL(request.url).searchParams);
  const report = await queryQualityEfficacy(filters);

  const lines = [
    csvRow(['Bloque', 'Clave', 'Descripción', 'Valor 1', 'Valor 2', 'Valor 3', 'Valor 4']),
    csvRow(['rango', 'desde', filters.from.toISOString(), 'hasta', filters.to.toISOString(), '', '']),
    csvRow([
      'puntos de control',
      'cabecera',
      'punto de control',
      'evaluaciones',
      'sigue / confirma / bloquea',
      'sin evaluar / reutilizadas',
      'score medio',
    ]),
    ...report.checkpoints.map((row) =>
      csvRow([
        'puntos de control',
        row.checkpoint,
        `${checkpointLabel(row.checkpoint)} (${checkpointKind(row.checkpoint)})`,
        row.evaluations,
        `${row.proceed} / ${row.confirm} / ${row.block}`,
        `${row.unevaluated} / ${row.reused}`,
        row.avgScore === null ? '' : row.avgScore.toFixed(2),
      ]),
    ),
    csvRow([
      'puntos de control',
      'bloqueos',
      'bloqueos por punto de control (cortaron gasto / informativos)',
      '',
      '',
      '',
      '',
    ]),
    ...report.checkpoints
      .filter((row) => row.block > 0)
      .map((row) =>
        csvRow([
          'puntos de control',
          `${row.checkpoint}:bloqueos`,
          checkpointLabel(row.checkpoint),
          row.block,
          row.blockedCut,
          row.blockedInformative,
          '',
        ]),
      ),
    csvRow(['coste', 'total_usd', 'coste de IA total', report.cost.totalUsd.toFixed(8), '', '', '']),
    csvRow([
      'coste',
      'reparto_usd',
      'reparto excluyente (prioridad: rehecho > bloqueado > aceptado > sin evaluar)',
      report.cost.acceptedUsd.toFixed(8),
      report.cost.blockedUsd.toFixed(8),
      report.cost.iteratedUsd.toFixed(8),
      report.cost.unscoredUsd.toFixed(8),
    ]),
    csvRow([
      'coste',
      'desperdiciado_usd',
      'gasto desperdiciado (bloqueados + rehechos)',
      report.cost.wastedUsd.toFixed(8),
      report.cost.blockedUsd.toFixed(8),
      report.cost.iteratedUsd.toFixed(8),
      '',
    ]),
    csvRow(['coste', 'jev_usd', 'coste de Jev', report.cost.jevCostUsd.toFixed(8), '', '', '']),
    csvRow([
      'ahorro',
      'estimado_usd',
      'ahorro estimado por bloqueos que cortaron gasto (media por petición del rango)',
      report.cost.avoidedUsd.toFixed(8),
      report.estimateBasis.avgGenerationUsd.toFixed(8),
      report.estimateBasis.avgIterationUsd.toFixed(8),
      report.cost.balanceUsd.toFixed(8),
    ]),
    ...report.savings.map((row) =>
      csvRow([
        'ahorro',
        row.checkpoint,
        checkpointLabel(row.checkpoint),
        row.blocked,
        row.avgGenerationUsd.toFixed(8),
        row.avoidedUsd.toFixed(8),
        '',
      ]),
    ),
    ...report.informative.map((row) =>
      csvRow([
        'bloqueos informativos',
        row.checkpoint,
        `${checkpointLabel(row.checkpoint)} (sin acción de pago cortada)`,
        row.blocked,
        '',
        '',
        '',
      ]),
    ),
    ...report.providers.map((row) =>
      csvRow([
        'proveedores',
        row.key,
        `${row.provider} · ${row.model}`,
        row.attempts,
        row.costUsd.toFixed(8),
        row.scored,
        row.avgScore === null ? '' : row.avgScore.toFixed(2),
      ]),
    ),
  ];

  return new Response('﻿' + lines.join(''), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="eficacia-calidad.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
