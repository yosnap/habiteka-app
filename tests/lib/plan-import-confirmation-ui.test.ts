import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlanQualityCard } from '@/components/plano-studio/plan-quality-card';
import { QualityVerdictCard } from '@/components/quality/quality-verdict-card';

const noop = () => {};
const blockedQuality = {
  score: 31,
  decision: 'block' as const,
  reasons: ['Hay estancias sin cerrar.'],
  failOpen: false,
};
const summary = { replacesExisting: true, rooms: 3, exteriors: 1, furniture: 2 };

describe('confirmación al enviar un plano importado', () => {
  it('no atribuye una evaluación puntuada a un fallo automático ni pide confirmar un bloqueo', () => {
    for (const quality of [{ ...blockedQuality, score: 86, decision: 'confirm' as const }, blockedQuality]) {
      const html = renderToStaticMarkup(createElement(QualityVerdictCard, { quality }));
      expect(html).not.toContain('No se pudo evaluar');
    }
    const html = renderToStaticMarkup(createElement(QualityVerdictCard, {
      quality: { ...blockedQuality, score: null, decision: 'confirm' },
    }));
    expect(html).toContain('No se pudo evaluar');
  });
  it('muestra una vez los motivos duplicados de revisiones antiguas, también en modo compacto', () => {
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(createElement(QualityVerdictCard, {
        quality: { ...blockedQuality, reasons: ['Motivo repetido', 'Motivo repetido', 'Segundo motivo'] }, compact,
      }));
      expect(html.match(/Motivo repetido/g)).toHaveLength(1);
      expect(html).toContain('Segundo motivo');
    }
  });
  it('no presenta el envío de un plano bloqueado como acción inmediata', () => {
    const html = renderToStaticMarkup(createElement(PlanQualityCard, {
      quality: blockedQuality,
      summary,
      confirmApply: false,
      busy: false,
      applying: false,
      onApply: noop,
      onCancel: noop,
    }));
    expect(html).toContain('Revisar envío al editor');
    expect(html).not.toContain('Abrir en el editor para corregir');
  });

  it('explica qué sustituye y qué contiene el nuevo plano antes de aceptarlo', () => {
    const html = renderToStaticMarkup(createElement(PlanQualityCard, {
      quality: blockedQuality,
      summary,
      confirmApply: true,
      busy: false,
      applying: false,
      onApply: noop,
      onCancel: noop,
    }));
    expect(html).toContain('reemplazará el plano actual');
    expect(html).toContain('3 estancias');
    expect(html).toContain('1 zona exterior');
    expect(html).toContain('2 muebles');
    expect(html).toContain('Cancelar');
  });

  it('no promete conservar el plano existente cuando el asistente desconoce su estado', () => {
    const html = renderToStaticMarkup(createElement(PlanQualityCard, {
      quality: blockedQuality,
      summary: { ...summary, replacesExisting: null },
      confirmApply: true,
      busy: false,
      applying: false,
      onApply: noop,
      onCancel: noop,
    }));
    expect(html).toContain('reemplazará su plano actual si ya existe');
    expect(html).toContain('Sí, enviar y abrir el editor');
  });

  it('impide enviar medidas cambiadas hasta recalcular la geometría', () => {
    const html = renderToStaticMarkup(createElement(PlanQualityCard, {
      quality: blockedQuality,
      summary,
      needsRefit: true,
      confirmApply: false,
      busy: false,
      applying: false,
      onApply: noop,
      onCancel: noop,
    }));
    expect(html).toContain('Recalcula el plano revisado antes de enviarlo');
    expect(html).toMatch(/<button[^>]*disabled/);
  });
});
