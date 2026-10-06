/** Los precios publicados de KIE y APIMart se leen de sus APIs públicas y se normalizan por id de modelo. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apimartPrices, clearProviderPricingCache, kieChatPrices } from '@/server/ai/provider-pricing';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
afterEach(() => { vi.restoreAllMocks(); clearProviderPricingCache(); });

describe('precios publicados por los proveedores', () => {
  it('KIE: recorre las páginas y toma el precio de entrada aunque mezcle mayúsculas, espacios e «input»', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ data: { pages: 2, records: [
        { modelDescription: 'claude-sonnet-5, chat, Input', usdPrice: '0.850' },
        { modelDescription: 'claude-sonnet-5, chat, Output', usdPrice: '4.275' },
        { modelDescription: 'Claude-Opus-4-6, chat, input', usdPrice: '1.425' },
      ] } }))
      .mockResolvedValueOnce(json({ data: { pages: 2, records: [{ modelDescription: 'Claude-fable-5 , chat, Input', usdPrice: '4' }] } }));
    const prices = await kieChatPrices();
    expect([...prices]).toEqual([['claude-sonnet-5', 0.85], ['claude-opus-4-6', 1.425], ['claude-fable-5', 4]]);
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ pageNum: 2, pageSize: 100, interfaceType: 'chat' });
    // Se guardan en caché: no se vuelven a pedir.
    await kieChatPrices();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('APIMart: precio de entrada con su descuento por defecto', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ data: { models: { llm: [
      { id: 'claude-sonnet-5', input_price_per_1m: 2, input_price_per_1m_after_discount: 1.6 },
      { id: 'sin-descuento', input_price_per_1m: 0.5 },
    ] } } }));
    expect([...await apimartPrices()]).toEqual([['claude-sonnet-5', 1.6], ['sin-descuento', 0.5]]);
  });

  it('si la API de precios falla, devuelve una lista vacía y lo vuelve a intentar la próxima vez', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('caída')).mockResolvedValueOnce(json({ data: { models: { llm: [{ id: 'x', input_price_per_1m: 1 }] } } }));
    expect((await apimartPrices()).size).toBe(0);
    expect((await apimartPrices()).get('x')).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
