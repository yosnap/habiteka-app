# Patio, exteriores y norma de dibujo

## Implementado

- Área rectangular abierta desde Construir → Patio / terraza; suelo editable, sin techo ni paredes físicas automáticas. Comparte lado completo existente.
- Ocho materiales propios locales: césped natural/artificial, tierra, gravilla, corteza, arena, asfalto y pavimento; generador reproducible con Sharp.
- 28 objetos paramétricos persistidos, representación 2D/3D y dimensiones: sombra, cerramientos, vegetación, huerto, caminos, parking/coche, agua, drenaje, barbacoa, decoración, riego y LED.
- LED interior/exterior con difusor emisivo y tres fuentes cálidas por tira.
- Contexto de diseño incluye material del suelo y distingue límites abiertos.
- Catálogo exterior prefiere patio; parking/caminos/drenajes bajos permiten objetos encima. Navegación evita postes y permite paso bajo pérgola.
- Norma general: lápiz en cada herramienta trazable, arrastre y vuelta automática a selección al terminar. Paredes y muretes dejan de encadenar clics. Escape cancela.
- Corregido campo columns:undefined al copiar escalera de esquemas anteriores a6.

## Verificación

- 762 tests pasan; 3 omitidos en suites editor-document/editor-v2/canvas (95 archivos pasan, 2 omitidos).
- TypeScript y ESLint enfocado pasan. git diff --check pasa. Build de producción pasa; avisos locales de credenciales OAuth Google/Facebook ausentes.
- Banco navegador con CanvasView real y PointerEvents: wall, guard-wall, rectangle, patio y measure comprueban cursor efectivo, geometría y selección tras soltar. Sin mocks de geometría/store.
- Menú real del proyecto de validación muestra Patio/terraza y activa herramienta con ayuda de arrastre.
- Banco reproducible: bun run scripts/test-drawing-browser-server.mjs; abrir URL impresa y pulsar Probar dibujo.

## Límites actuales

- Patio rectangular; unión por lado completo, no división automática de uniones parciales.
- Objetos paramétricos del editor; piscina elevada; riego y drenaje como elementos de diseño sin simulación hidráulica.
- Texturas originales procedurales. RGB de emisión pendiente issue42; LED cálido.
- No generaciones IA de pago realizadas. Visita profesional y vídeo desde diseño aprobado siguen en el plan principal, no se confunden con estos modelos de edición.

## Preguntas abiertas

Ninguna bloquea este cambio.
