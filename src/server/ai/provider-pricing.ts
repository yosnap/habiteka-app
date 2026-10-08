/**
 * Precios de entrada (USD por millón de tokens) que publican los proveedores con una API de precios pública, para
 * rellenarlos al habilitar un modelo: KIE (la de su web de precios, por modelo y tipo de token) y APIMart (con su
 * descuento por defecto). OpenRouter los da en su propia lista de modelos. Se guardan una hora; si la API falla, el
 * panel sigue funcionando y el precio se escribe a mano.
 */
const TTL_MS = 60 * 60 * 1000;
const KIE_PRICING_URL = 'https://api.kie.ai/client/v1/model-pricing/page';
const APIMART_PRICING_URL = 'https://api.apimart.ai/api/pricing/models/all';

const cache = new Map<string, { at: number; prices: Map<string, number> }>();

async function cached(key: string, load: () => Promise<Map<string, number>>): Promise<Map<string, number>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.prices;
  const prices = await load().catch(() => new Map<string, number>());
  // Un fallo no se guarda: el siguiente intento vuelve a pedirlos.
  if (prices.size) cache.set(key, { at: Date.now(), prices });
  return prices;
}

const price = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 1e4) / 1e4 : undefined;
};

/** Precio de entrada de los modelos de chat de KIE, por id en minúsculas (su web mezcla «Claude-Opus-4-6» y «claude-opus-5»). */
export function kieChatPrices(): Promise<Map<string, number>> {
  return cached('kie', async () => {
    const prices = new Map<string, number>();
    for (let page = 1, pages = 1; page <= pages && page <= 10; page++) {
      const response = await fetch(KIE_PRICING_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({ pageNum: page, pageSize: 100, interfaceType: 'chat' }) });
      const body = await response.json() as { data?: { pages?: number; records?: { modelDescription?: string; usdPrice?: unknown }[] } };
      pages = body.data?.pages ?? 1;
      for (const record of body.data?.records ?? []) {
        // «claude-sonnet-5, chat, Input»: modelo, tipo de interfaz y tipo de token.
        const [model, , kind] = (record.modelDescription ?? '').split(',').map((part) => part.trim());
        const usd = price(record.usdPrice);
        if (model && kind?.toLowerCase() === 'input' && usd !== undefined) prices.set(model.toLowerCase(), usd);
      }
    }
    return prices;
  });
}

/** Precio de entrada de los modelos de texto de APIMart, con el descuento que aplica por defecto. */
export function apimartPrices(): Promise<Map<string, number>> {
  return cached('apimart', async () => {
    const response = await fetch(APIMART_PRICING_URL, { signal: AbortSignal.timeout(15_000) });
    const body = await response.json() as { data?: { models?: { llm?: { id?: string; input_price_per_1m?: unknown; input_price_per_1m_after_discount?: unknown }[] } } };
    const prices = new Map<string, number>();
    for (const model of body.data?.models?.llm ?? []) {
      const usd = price(model.input_price_per_1m_after_discount ?? model.input_price_per_1m);
      if (model.id && usd !== undefined) prices.set(model.id, usd);
    }
    return prices;
  });
}

export function clearProviderPricingCache(): void {
  cache.clear();
}
