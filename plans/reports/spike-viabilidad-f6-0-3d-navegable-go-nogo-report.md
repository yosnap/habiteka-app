# F6.0 · Spike de viabilidad 3D navegable — Reporte GO/NO-GO

**Fecha:** 2026-06-22 · **Rama:** `feat/canvas/f6-3d-navegable` · **Tipo:** spike desechable

## Veredicto: ✅ **GO**

El stack Three.js + React Three Fiber + drei renderiza una sala 3D real desde un
`CanvasDoc` existente, a escala correcta, con un modelo glTF real cargado, muy por
encima del umbral de rendimiento. El módulo 3D queda aislado en su propio chunk
(lazy-load), sin inflar el bundle del editor 2D.

## Qué se montó (desechable)

- **Ruta aislada** `/dev/3d` (fuera del área autenticada) → consume `EXAMPLE_SALON`
  (`CanvasDoc` real, escala 100 px/m, 6 elementos estructurales + muebles).
- **Lógica pura** `src/canvas/3d/spike/doc-to-room.ts`: convierte el doc a suelo +
  muros en metros, mapeando ejes Konva (Y-abajo) → Three (Y-arriba / Z-profundidad)
  y centrando la escena. *(Base mental para F6.1; allí se reescribe con tests.)*
- **Vista R3F** `src/components/canvas/3d/plan-3d-view.tsx`: suelo, muros extruidos
  a altura de techo, **1 glTF real** (sofá CC0 con materiales PBR), OrbitControls,
  luz ambiental + direccional, rejilla, y sonda de FPS + draw calls + triángulos.

## Mediciones (criterio del /ck:predict)

| Métrica | Umbral | Medido | Resultado |
|---|---|---|---|
| FPS escritorio | ≥30 | **60** (cap vsync) | ✅ holgado |
| glTF real cargado (ajuste 1) | ≥1 | sí (sofá PBR) | ✅ |
| Draw calls | — | **11** (sala 7 + grid + sofá ~3) | informativo |
| Triángulos | — | **4.272** (la mayoría del glTF) | ✅ prueba que el glTF renderiza |
| Escala px→m | exacta | suelo **5,2 × 3,7 m** vs cota 2D 5,2 × 3,6 m (+grosor muro) | ✅ correcta |
| Errores de consola | 0 | 0 (solo warn benigno `Clock` deprecado) | ✅ |

> El FPS=60 es con el glTF "caro" en escena (4.272 tris, materiales PBR), no con
> cajas vacías — exactamente lo que el ajuste 1 del predict exigía probar.

## Bundle (peso que añade el stack 3D)

- **Chunk del módulo 3D:** **948 KB sin gzip ≈ 252 KB gzip** — contiene
  `WebGLRenderer`, `react-three-fiber`, `OrbitControls`, `THREE`.
- **Aislamiento (lazy-load):** el único importador del módulo 3D es `/dev/3d` vía
  `dynamic(import())`. El editor 2D NO lo referencia → el chunk de three **no entra
  en el First Load del editor**. Confirmado por grep + estructura de chunks del build.
- **glTF de prueba:** 3,0 MB (`sofa.glb`). En producción los modelos van bajo demanda
  y se comprimen (Draco/meshopt) — fase F6.2.

## Versiones instaladas

`three@0.184.0` · `@react-three/fiber@9.6.1` · `@react-three/drei@10.7.7` ·
`@types/three@0.184.1`. Instaladas con **bun**.

## Verificación realizada

- `bunx tsc --noEmit`: sin errores en código F6 (hay 1 error PREEXISTENTE ajeno en
  `tests/canvas/canvas-clipboard.test.ts` — usa `kind:"muro"` ya renombrado a `wall`).
- `bunx eslint` sobre los 3 archivos nuevos: limpio.
- `bun run build`: OK; `/dev/3d` prerenderiza como estático.
- **Dev server + navegador (chrome-devtools):** escena 3D visible, FPS/escala
  verificados contra el HUD, consola sin errores. *(Lección de sesiones previas:
  verificar contra el build real, no solo tsc/tests.)* Screenshot:
  `plans/reports/spike-f6-0-3d-escena.png`.

## Observaciones para las fases siguientes

- El sofá glTF se renderiza dentro de la sala (correcto); desde la cámara orbital
  exterior queda tras los muros — en F6.4 habrá "ocultar techo/suelo" para ver el
  interior. Su presencia está probada por las métricas (draw calls / triángulos).
- Muros = cajas sólidas sin huecos para puerta/ventana. Los huecos son refinamiento
  posterior (no bloquean F6).
- El reajuste de cámara con `<Bounds>` de drei secuestraba el encuadre al sofá
  (sala invisible). Solución en el spike: normalizar el glTF por bounding box
  (escala a ~2 m, apoyado en y=0) en vez de `<Bounds>`. A tener en cuenta en F6.2/F6.4.
- Sombras OFF por defecto (ajuste 4 del predict); con sombras OFF ya hay 60 FPS.
- Móvil: best-effort en v1 (no medido en este spike; se mide en F6.5).

## Artefactos del spike (a borrar o evolucionar en F6.1+)

- `src/app/dev/3d/page.tsx` — ruta de prueba (borrar; la UI real es F6.4).
- `src/components/canvas/3d/plan-3d-view.tsx` — evoluciona en F6.1/F6.4.
- `src/canvas/3d/spike/doc-to-room.ts` — se reescribe con tests en F6.1.
- `public/models/kenney/sofa.glb` — placeholder; F6.2 integra el Kit de Kenney real.

## Nota sobre el asset glTF

El plan pedía Kenney Furniture Kit (CC0). Kenney distribuye el kit como ZIP
(descarga interactiva en kenney.nl), no como `.glb` individuales en raw GitHub. Para
el spike — cuyo objetivo es medir el coste de un glTF real, no su procedencia — se usó
un modelo CC0/royalty-free de `KhronosGroup/glTF-Sample-Assets` (sofá con materiales
PBR), descargable directo. **F6.2** integrará el Kit de Kenney completo y el mapa
declarativo kind→glTF.

## Siguiente paso

Stack confirmado → lanzar `/ck:plan` para detallar **F6.1 (doc→escena 3D con tests
de conversión px→m y mapeo de ejes)** y siguientes, como indica el plan.md de F6.
