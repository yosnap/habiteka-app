import { afterEach, describe, expect, it, vi } from 'vitest';
import { visitFixture } from '../fixtures/property-visit-job';
import { propertyVisitVideoBudget, propertyVisitDurationIssue } from '@/lib/editor-document/property-visit-budget';
import { PROPERTY_VISIT_COMPACT_MODEL } from '@/lib/editor-document/property-visit-job';
vi.mock('server-only', () => ({}));
import { assertPropertyVisitBudget, inspectPropertyVisitBudget, assertStandaloneVideoBudget } from '@/server/walkthrough/property-visit-budget';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('límite de 2 euros para el vídeo completo', () => {
  it('el minuto Hailuo cuesta 1,50 USD, conserva tarifa antigua y cuenta los reintentos completos', () => {
    const job = visitFixture(); job.videoModel = PROPERTY_VISIT_COMPACT_MODEL;
    job.segments = Array.from({ length: 10 }, (_, index) => ({ ...job.segments[0]!, id: String(index), seconds: 6 })); job.durationMs = 60000;
    expect(propertyVisitDurationIssue(job)).toBeNull();
    expect(propertyVisitVideoBudget(job, 1.1177)).toMatchObject({ usd: expect.closeTo(1.5), eurWithReserve: 1.75, issue: null });
    job.segments[0]!.attempts = [{ state: 'rejected' }, { state: 'failed' }];
    expect(propertyVisitVideoBudget(job, 1.1177).issue).toContain('2 €');
    delete job.videoModel;
    expect(propertyVisitVideoBudget(job, 1.1177).issue).toContain('2 €');
  });
  it('bloquea duración mayor de un minuto y metadatos inconsistentes antes de consultar cambio', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const job = visitFixture(); job.durationMs = 61000;
    await expect(assertPropertyVisitBudget(job)).rejects.toThrow('60 segundos');
    await expect(assertStandaloneVideoBudget(.48, 61000)).rejects.toThrow('60 segundos');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('suma todos los tramos y sus reintentos, sin reiniciar el presupuesto por fragmento', () => {
    const job = visitFixture(); expect(propertyVisitVideoBudget(job, 1.1269).issue).toBeNull();
    job.segments = Array.from({ length: 20 }, (_, index) => ({ ...job.segments[0]!, id: String(index) }));
    expect(propertyVisitVideoBudget(job, 1.1269).issue).toContain('vídeo completo');
    job.segments = [job.segments[0]!]; job.segments[0]!.attempts = Array.from({ length: 12 }, () => ({ state: 'failed' as const }));
    expect(propertyVisitVideoBudget(job, 1.1269).issue).toContain('2 €');
  });
  it('verifica el cambio reciente y deja margen para cargos', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-07T18:00:00Z'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response("<Cube time='2026-10-06'><Cube currency='USD' rate='1.1269'/></Cube>")));
    expect(await inspectPropertyVisitBudget(visitFixture())).toMatchObject({ maxEur: 2, eurWithReserve: .37, issue: null, rateDate: '2026-10-06' });
  });
  it.each(['<Cube/>', "<Cube time='2020-01-01'><Cube currency='USD' rate='1.1269'/></Cube>"])('sin cambio verificable bloquea el envío: %s', async xml => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(xml)));
    await expect(assertPropertyVisitBudget(visitFixture())).rejects.toThrow('bloqueada');
  });
});
