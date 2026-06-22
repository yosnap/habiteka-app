# F6 · 3D navegable — Plan de ejecución

**Estado:** 📋 LISTO PARA EJECUTAR. Primer desarrollo post-multizona (decisión del usuario, jun-2026).
**Tipo:** XL (semanas). Se ejecuta por fases; cada fase es un PR independiente con su verificación.

**Objetivo:** convertir el plano 2D (`CanvasDoc`) en una **escena 3D navegable real** (R3F): muros
extruidos, suelo, muebles glTF colocados por geometría, cámara orbital. Es la vista FIEL del diseño
(no la "imagina" la IA). Complementa el render IA (CRL-4), no lo sustituye.

## Documentos de referencia (leer antes de cada fase)
- `arranque-f6-para-chat-nuevo.md` (este directorio) — contexto + qué está resuelto + prompt.
- `../260621-1407-disenos-interactivos-vistas-3d/phase-f6-3d-navegable.md` — research del stack +
  incógnitas (cobertura catálogo, alturas) ya resueltas en revisión.
- `../260622-1142-referencia-planner5d/referencia-planner5d-y-gaps.md` — por qué F6 (Planner5D valida
  el enfoque: 2D y 3D = misma geometría).

## Lo que ya está resuelto (NO re-investigar)
- **Stack:** Three.js + R3F + `@react-three/drei`, montaje cliente-only (`dynamic ssr:false`).
- **Modelos:** Kenney Furniture Kit (140 glTF CC0). `gltfjsx` para convertir. Placeholder (caja
  etiquetada) para kinds sin modelo.
- **Datos de entrada:** ya existen en `src/canvas/types.ts` — `pxPerMeter` (escala F0),
  `ceilingHeightM`, `heightM` por objeto, luces F-LUZ. F6 solo los consume.
- **Multi-zona:** el 3D se renderiza por zona (`withOrg(ctx).canvas.load(projectId, zoneId)`).

## Decisiones de producto a confirmar al arrancar (no bloquean el spike)
- Cámara v1 = OrbitControls (recomendado, suficiente). PointerLock (1ª persona) = v2 futuro.
- 3D **complementa** el render IA (entregables distintos), no lo sustituye.

## Ajustes del /ck:predict (jun-2026, veredicto GO con 3 ajustes)
El debate de personas aprobó el enfoque (GO) con estos ajustes ya incorporados a las fases:
1. **El spike F6.0 DEBE cargar ≥1 modelo glTF real de Kenney** (no solo muros/suelo). Lo que pesa y
   baja FPS son los modelos+texturas+draw calls, no las cajas. Un spike de sala vacía daría un GO
   falso. → incorporado a F6.0.
2. **Fijar umbral de rendimiento ANTES del spike** para que el GO/NO-GO sea objetivo: **≥30 FPS en
   portátil medio (escritorio); móvil = best-effort en v1**. → criterio de F6.0.
3. **F6.1 incluye tests de la conversión pura px→m y del mapeo de ejes** (Konva Y-abajo → Three
   Y-arriba/Z-profundidad). Es la fuente de bugs sutiles de desalineación 2D↔3D y es lógica pura
   testeable sin render. → incorporado a F6.1.
4. Menor: **sombras OFF por defecto en v1** (F6.3); activar solo si el FPS lo permite.
Red-team/security: descartado formalmente — F6 es render cliente sin datos nuevos ni auth nueva; el
code-review por fase basta.

## Fases (cada una = PR; orden estricto)

### F6.0 · Spike de viabilidad (GO/NO-GO del stack) → phase-f6-0-spike-viabilidad.md
Sala (muros + suelo) desde un `CanvasDoc` real con R3F + OrbitControls **Y ≥1 modelo glTF real de
Kenney cargado** (ajuste 1 del predict: probar lo caro, no solo cajas). Verificar escala correcta
contra las cotas del 2D. **Umbral GO (ajuste 2): ≥30 FPS en portátil medio; móvil best-effort.**
Medir bundle (peso que añaden three/R3F/drei + el glTF). Decide GO/NO-GO del stack. **Desechable.**

### F6.1 · doc→escena 3D (geometría base) → phase-f6-1-doc-a-escena.md
Conversión robusta del `CanvasDoc` a escena: muros (cajas extruidas a `ceilingHeightM`, grosor),
suelo del polígono, sistema de coordenadas px→metros. Sin muebles aún. Lógica pura testeable
(mapeo doc→primitivas 3D) separada del render. **Tests obligatorios (ajuste 3 del predict): conversión
px→m y mapeo de ejes (Konva Y-abajo → Three Y-arriba/Z-profundidad)** — un punto del plano → su
coordenada 3D esperada. Es la fuente de bugs de desalineación 2D↔3D.

### F6.2 · Pipeline de assets + muebles glTF → phase-f6-2-pipeline-muebles.md
Integrar Kenney Kit; mapa declarativo kind→glTF; cargador cacheado (`useGLTF` + preload). Colocar
cada `StructObj` por posición/rotación/medidas reales. Placeholder para kinds sin modelo. Draco/meshopt.

### F6.3 · Luces (F-LUZ → Three.js) → phase-f6-3-luces.md
Mapear el modelo de luz (color/intensidad de F-LUZ) a luces Three.js (Point/Spot). Iluminación
ambiental base + Environment (HDRI CC0).

### F6.4 · UI + navegación + lazy-load → phase-f6-4-ui-navegacion.md
Botón "Ver en 3D" en el editor del plano; vista a pantalla; OrbitControls; Hide ceil/floor para ver
interior. Lazy-load del módulo 3D (no inflar el main bundle). Render por zona activa.

### F6.5 · Rendimiento + pulido → phase-f6-5-rendimiento.md
Medición final (bundle, FPS escritorio/móvil), preload, límites de luces, optimización de mallas.
Code-review del flujo completo.

## Verificación (cada fase)
- `bunx tsc` + eslint + tests focales (`bunx vitest run`).
- **Arrancar dev server y VER la escena 3D en el navegador** (lección de sesiones previas: verificar
  contra el build real, no solo tsc/tests). El 3D es WebGL → confirmar visualmente.
- Code-review (flujo cook) en las fases de geometría y rendimiento.

## Riesgos
- Bundle pesado (three/R3F/drei) → lazy-load aislado obligatorio. Se mide en F6.0.
- Cobertura de modelos → placeholder declarativo (no bloquea).
- Rendimiento móvil → medir pronto (F6.0) para decidir límites.

## Acceptance (F6 "hecho")
Un usuario abre un plano (con muros, suelo, muebles, luces) y pulsa "Ver en 3D" → ve la sala en 3D
navegable (orbitar), a escala real, con los muebles donde los colocó en 2D, e iluminada. Funciona por
zona. El bundle 3D va lazy. Sin regresiones en el editor 2D.
