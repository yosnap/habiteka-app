# F6.5 · Medición final y cierre del rasgo F6 (3D navegable)

**Fecha:** 2026-06-22 · **Rama:** `feat/canvas/f6-3d-navegable`

## Estado: ✅ F6 (3D navegable) COMPLETO

Las 6 fases cerradas: F6.0 spike (GO) → F6.1 doc→escena → F6.2 muebles glTF → F6.3 luces
→ F6.4 UI "Ver en 3D" + recorte de muros → F6.5 rendimiento + pulido.

## Medición de rendimiento

| Métrica | Valor | Umbral (predict) |
|---|---|---|
| FPS escritorio | **60** (vsync) | ≥30 ✅ |
| FPS móvil (390×844 DPR3, CPU 4× throttle) | **60** | best-effort ✅ supera |
| Escena del salón | 6 muros · 4 muebles · 1 luz | — |
| Draw calls | 13 | — |
| Triángulos | 8.786 | — |
| Chunk módulo 3D (three+R3F+drei) | 952 KB / **253 KB gzip** | lazy ✅ |

## Optimización de assets glTF (el cuello real)

Compresión con `@gltf-transform/cli` 4.4 (`optimize --texture-compress webp --texture-size
1024 --compress meshopt`):

| Modelo | Antes | Después | Reducción |
|---|---|---|---|
| lampara.glb (Lantern) | 9,56 MB | **0,27 MB** | −97% |
| silla.glb (SheenChair) | 4,13 MB | **0,71 MB** | −83% |
| sofa.glb (GlamVelvetSofa) | 3,15 MB | **0,41 MB** | −87% |
| **Total** | **16,05 MB** | **1,38 MB** | **−91%** |

Sin pérdida visible (verificado en `/dev/3d`). El grueso del peso eran las texturas → WebP +
resize a 1024. drei trae el `MeshoptDecoder`; los modelos cargan sin error.
Borrado el duplicado huérfano `public/models/kenney/sofa.glb` (deuda del spike).

## Robustez de escena

- **Límite de luces:** `MAX_LIGHTS = 8`; `limitLights` conserva las más intensas (forward
  rendering: muchas PointLights hunden el FPS). Lógica pura testeada.
- **Recorte de muros (`useFrame`):** sin allocations por frame (`shouldHideWallXZ` con
  escalares, no arrays).
- **Preload selectivo:** solo los modelos de los kinds presentes en la escena, vía
  `useMountEffect` (ya no side-effect en el cuerpo del módulo).

## Code-review del flujo completo

Revisado por el agente code-reviewer (DONE_WITH_CONCERNS). Hallazgos accionables resueltos:

- **A1 — `flipX` ignorado en 3D** (desajuste 2D↔3D): RESUELTO. `FurnitureItem.flipX` +
  escala X negativa en `FurnitureModel`; test que lo congela.
- **A2 — fuga de recursos GPU del glTF clonado** (al reabrir el 3D en multi-zona): RESUELTO.
  `scene.clone(true)` + `<primitive>` → `<Clone>` de drei (libera el clon al desmontar).
- **M1 — `useGLTF.preload` como side-effect de módulo** (viola regla del repo): RESUELTO.
  Movido a `useMountEffect`, selectivo por kinds presentes.
- **M3 — suelo degenerado `[0,0]` con doc vacío:** RESUELTO. Guard en `RoomMesh`.

Anotados (no aplicados, bajo impacto): M2 (calibración de `MAX_POINT_INTENSITY`, documentada),
B1 (`isLight` duplicado con semántica distinta — intencional, comentado), B2 (bounding box
recalculado — O(n), memoizado), B3 (HUD muestra 0 ~500 ms — cosmético).

## Verificación final

- `bunx tsc --noEmit`: exit 0.
- `bunx eslint` (archivos F6): limpio.
- `bunx vitest run tests/canvas/`: **126/126 verdes**.
- `bun run build`: OK; chunk three NO en el First Load de `/projects/[id]` (lazy confirmado).
- Navegador `/dev/3d`: escena completa (muros recortados, muebles, luz visible), 60 FPS, 0 errores.

## Acceptance de F6 (del plan padre) — cumplido

> Un usuario abre un plano y pulsa "Ver en 3D" → ve la sala en 3D navegable (orbitar), a
> escala real, con los muebles donde los colocó en 2D, e iluminada. Funciona por zona. El
> bundle 3D va lazy. Sin regresiones en el editor 2D.

Todo verificado **incluido el flujo en el EDITOR REAL** (dev-login `/api/dev/login` como
admin@habiteka.dev): abierto el proyecto "Salón de ejemplo", pulsado "Ver en 3D" → overlay a
pantalla completa con la sala de la BD (6 muros, 4 muebles, sofá+lámpara reales + placeholders,
recorte de muros, 60 FPS, 12 draw calls, 0 errores de consola); Esc cierra y vuelve al editor 2D
intacto. Screenshot: `plans/reports/f6-editor-real-overlay-3d.png`. No quedan huecos de verificación.

## Deuda / mejoras futuras (no bloquean F6)

- Afinado fino de iluminación (calibración intensidad/contraste; opción spotLight con cono
  volumétrico) — acordado con el usuario diferirlo.
- Recorte de muros: transición suave (lerp de opacidad) en vez de binario visible/oculto.
- Integrar el Kit de Kenney completo y ampliar el mapa `kind→glTF` (hoy 3 modelos + placeholder).
- Huecos reales de puertas/ventanas en los muros (hoy son cajas sólidas).
- Verificación del flujo en el editor real con login.

## Artefactos de dev (no producción)

- `src/app/dev/3d/page.tsx` — ruta de prueba (no enlazada en la app; útil para QA del 3D).
  Incluye `?luz=0` para comparar con/sin luz.

## Preguntas abiertas

- ¿Se publica F6 ahora (push de la rama) o se acumula con más trabajo? Todo el bloque F6
  (spike + F6.1–F6.5) está SIN commit (convención del usuario: cerrar fases antes de publicar).
