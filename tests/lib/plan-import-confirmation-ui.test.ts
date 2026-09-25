import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlanQualityCard } from '@/components/plano-studio/plan-quality-card';

const noop = () => {};
const blockedQuality = {
  score: 31,
  decision: 'block' as const,
  reasons: ['Hay estancias sin cerrar.'],
  failOpen: false,
};
const summary = { replacesExisting: true, rooms: 3, exteriors: 1, furniture: 2 };

describe('confirmación al enviar un plano importado', () => {
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
