# F6 · 3D navegable — Arranque para chat nuevo

**Propósito:** punto de entrada para empezar a DESARROLLAR F6 (3D navegable con Three.js/R3F) en una
sesión nueva. Decisión del usuario (jun-2026): F6 es el primer desarrollo post-multizona.

## Contexto en 30 segundos

Habiteka es un editor de planos 2D con IA. F6 añade la **vista 3D navegable real**: el plano 2D se
convierte en una escena 3D (muros extruidos, suelo, muebles glTF) por GEOMETRÍA, no por IA. Es la
solución a la fidelidad (un render IA recoloca elementos; el 3D no, porque se construye del plano).
Validado contra Planner5D: su 3D hace exactamente esto (ver
`plans/260622-1142-referencia-planner5d/referencia-planner5d-y-gaps.md`).

## Lo que YA está resuelto (no re-investigar)

- **Stack:** Three.js + React Three Fiber (R3F) + `@react-three/drei`. Montaje cliente-only
  (`dynamic ssr:false`), como ya hace `src/components/canvas/canvas-stage.tsx`.
- **Modelos:** Kenney "Furniture Kit" (140 glTF, CC0, uso comercial sin atribución). `gltfjsx` para
  convertir a componentes R3F. Complementos CC0: Poly Pizza, Quaternius, Poly Haven (HDRI).
- **Datos de entrada YA EXISTEN en el modelo** (`src/canvas/types.ts`): `CanvasDoc` con `pxPerMeter`
  (escala, F0), `ceilingHeightM` (altura de techo), objetos con `heightM` + medidas reales, luces
  (F-LUZ con color/intensidad). F6 SOLO consume esto; no necesita campos nuevos.
- **Cobertura catálogo:** ~30 kinds (`src/canvas/catalog.ts`). Kenney cubre la mayoría; los que no
  (chimenea, foco) → placeholder (caja a escala etiquetada), patrón análogo al `default` de
  `object-shapes.tsx` en 2D. Mapeo kind→glTF declarativo (extiende F-CAT).
- **Multi-zona (P3) ya hecho:** el 3D se renderiza por zona (cada zona tiene su `CanvasState`).
  `withOrg(ctx).canvas.load(projectId, zoneId)` da el doc de la zona.

## Lo que falta decidir/medir (en el spike, primer paso)

1. **Bundle + rendimiento:** medir peso de three/R3F/drei + glTF y FPS (incl. móvil). Lazy-load.
2. **Cámara v1:** OrbitControls (recomendado, suficiente) vs PointerLock (primera persona, v2).
3. **¿Sustituye o complementa al render IA (CRL-4)?** Recomendación: complementan (entregables
   distintos). Confirmar con el usuario.

## Primer paso concreto: SPIKE de viabilidad (desechable)

Objetivo: renderizar una **sala vacía (muros + suelo) desde un `CanvasDoc` real** con R3F, medir
bundle y FPS, decidir GO/NO-GO del stack. NO amueblar aún (eso es fase 3).

Pasos del spike:
1. `bun add three @react-three/fiber @react-three/drei` (+ tipos). Anotar el peso que añaden.
2. Componente cliente-only `<Plan3DView doc={CanvasDoc} />`:
   - Suelo = plano del polígono de la sala (de los muros del doc, a escala `pxPerMeter`).
   - Muros = cajas extruidas a `ceilingHeightM` (o default), grosor del muro.
   - OrbitControls + una luz ambiental + una direccional.
3. Montarlo tras un botón "Ver en 3D" en el editor (lazy `dynamic ssr:false`).
4. Cargar un plano real (p. ej. el "Salón de ejemplo" del dev-seed) y verificar que las paredes
   salen a escala correcta (medir contra las cotas del 2D).
5. Medir: tamaño del bundle del módulo 3D, FPS en escritorio y (si se puede) móvil.

Verificación: `bunx tsc` + eslint + **arrancar el dev server y ver la escena 3D en el navegador**
(lección de sesiones previas: verificar siempre contra el build real, no solo tsc/tests).

## Tras el spike (si GO): plan completo con /ck:plan

Las fases internas ya están propuestas en
`plans/260621-1407-disenos-interactivos-vistas-3d/phase-f6-3d-navegable.md` (sección "Fases internas
propuestas"): spike → pipeline assets → doc→escena → luces → cámara → UI → rendimiento. Lanzar
`/ck:plan` con esas fases una vez el spike confirme el stack.

## Estado de git al arrancar

- Rama actual: `feat/multizona/p3-zonas` (P1/P2/P3 commiteadas, SIN push — decisión del usuario:
  cerrar fases antes de publicar). Para F6: rama nueva `feat/canvas/f6-3d-navegable` desde donde
  corresponda (¿desde p3-zonas o tras mergear a develop? — decidir al arrancar).
- Convenciones: BUN (no npm), commits convencionales en español sin refs a IA, verificar en dev
  server con chrome-devtools, tests focales con `bunx vitest run`.

## Prompt sugerido para el chat nuevo

> Arranco F6 (3D navegable) en Habiteka. Lee
> `plans/260622-1208-f6-3d-navegable-arranque/arranque-f6-para-chat-nuevo.md` y la memoria
> (`referencia-planner5d`, `roadmap-disenos-interactivos-estado`). Empieza por el SPIKE de viabilidad:
> sala vacía (muros+suelo) desde un CanvasDoc real con R3F, medir bundle/FPS, GO/NO-GO del stack.
