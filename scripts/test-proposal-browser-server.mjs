/** Ejecutar con Bun. Sirve solo un banco UI local temporal; detener con Ctrl+C. */
const bundle = await Bun.build({ entrypoints: ['./tests/editor-v2/proposal-browser-fixture.tsx'], target: 'browser',
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, minify: true,
  plugins: [{ name: 'next-image-browser-fixture', setup(build) {
    // Solo infraestructura Next/Image, ajena al flujo de aplicación que se prueba.
    build.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'image', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'import {createElement} from "react"; export default function Image(p){return createElement("img",p)}', loader: 'js' }));
  } }] });
if (!bundle.success) throw new Error(bundle.logs.join('\n'));
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
  if (new URL(request.url).pathname === '/fixture.js') return new Response(bundle.outputs[0], { headers: { 'Content-Type': 'application/javascript' } });
  return new Response('<!doctype html><html><head><meta charset="utf-8"><title>Prueba local propuesta</title></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>', { headers: { 'Content-Type': 'text/html' } });
} });
console.log(`Banco de pruebas: ${server.url}`);
export {};
