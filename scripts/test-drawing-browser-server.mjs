/** Banco local con CanvasView real: verifica los eventos de dibujo y retorno a selección. */
const bundle = await Bun.build({ entrypoints: ['./tests/editor-v2/drawing-browser-fixture.tsx'], target: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' }, minify: true });
if (!bundle.success) throw new Error(bundle.logs.join('\n'));
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
  const path = new URL(request.url).pathname;
  const artifact = bundle.outputs.find((output) => path === '/' + output.path.split('/').pop());
  if (artifact) return new Response(artifact);
  const assets = bundle.outputs.map((output) => output.path.split('/').pop());
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Validación dibujo</title>${assets.filter((p) => p.endsWith('.css')).map((p) => `<link rel="stylesheet" href="/${p}">`).join('')}</head><body><div id="root"></div>${assets.filter((p) => p.endsWith('.js')).map((p) => `<script type="module" src="/${p}"></script>`).join('')}</body></html>`, { headers: { 'Content-Type': 'text/html' } });
} });
console.log(`Banco de pruebas: ${server.url}`);
