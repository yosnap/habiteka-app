# F7 · Wizard de diseño guiado — Reporte de cierre

**Fecha:** 2026-06-22 · **Rama:** `feat/canvas/f6-3d-navegable` · **Estado:** ✅ COMPLETO (8/8)

## Qué entrega F7
Lleva el editor hacia el flujo de Planner5D, sobre la base de F6 (3D navegable):

| Fase | Entrega | Estado |
|---|---|---|
| F7.1 | Línea base 2D↔3D + diagnóstico del pivote de rotación (test) | ✅ |
| F7.2 | **Draw Walls**: dibujar muros como líneas con cota en vivo + fix del pivote 2D↔3D | ✅ |
| F7.3 | Snap de ángulo (0/45/90°) + longitud exacta tecleada | ✅ |
| F7.4 | **Wizard guiado** desde zona vacía (medidas → tipo → crear) | ✅ |
| F7.5 | **Auto-amueblado procedural** por tipo de sala (sin IA) + pulido del wizard (sliders, preview, iconos) | ✅ |
| F7.6 | Infraestructura de orientación de muebles (`frontOffsetRad` por modelo) | ✅ |
| F7.7 | Quitar la farola (lámpara→placeholder), manifiesto de assets, validación | ✅ |
| F7.8 | Verificación end-to-end + code-review | ✅ |

## Hito clave (red-team)
El **pivote de rotación 2D↔3D no coincidía** (Konva rota sobre esquina, docToScene sobre centro del
AABB): latente porque todo el contenido era axis-aligned. Draw Walls lo habría roto. Corregido en la
raíz (`objectCenterPx`) y testeado; cualquier objeto rotado cae bien en 3D.

## Verificación
- **tsc + eslint**: limpios. **Suite COMPLETA: 450 tests verdes** (2 skipped, integración externa).
- **Build de producción**: OK.
- **Navegador (dev-login admin)**, flujo real:
  - Draw Walls con cota "3 m" en vivo, snap horizontal, muro de 4,5 m tecleado → correctos en 3D.
  - Wizard v2 (sliders + preview + iconos) en zona vacía → sala 4×3 m → auto-amueblado "Salón"
    (sofá pared sur, TV norte, mesa centro) → todo en 3D, FPS 60.
  - Lámpara ya NO es farola (placeholder); salón sin modelos fuera de lugar.
  - 0 errores de consola en todos los casos.

## Code-review (agente, DONE_WITH_CONCERNS)
Sin hallazgos Críticos ni Altos. Aplicado: **DRY de `kindSizePx`** → reusa `catalogSizePx` (Medio).
Anotados (no aplicados, bajo impacto o deliberados):
- `useEffect` directo de reset en `canvas-stage` (consistente con el archivo; depende de `tool`).
- `flipX` con escala negativa puede invertir normales (solo silla/sofa; revisar si se añaden modelos).
- Guardado doble del wizard (autosave + flush): deliberado (garantía anti-pérdida, red-team #3).
- Errores de persistencia silenciados (patrón preexistente del autosave; toast = mejora futura).

## Acceptance de F7 — cumplido
- Dibujar muros como líneas con cota en vivo y snap; se ven en 3D. ✅
- Wizard guiado funcional desde zona vacía. ✅
- Auto-amueblado procedural por tipo de sala, determinista. ✅
- Muebles colocados con sentido (anclaje a pared); orientación = infraestructura lista. ✅
- Modelos coherentes (lámpara ≠ farola); placeholders honestos. ✅
- tsc + eslint + tests verdes; verificado en navegador con proyecto nuevo. ✅

## Deuda / mejoras futuras (anotadas)
- **Tipos de sala combinados** (cocina americana = cocina+salón), estudio, comedor — pedido del usuario.
- **Calibración fina de orientación** (`frontOffsetRad` por modelo) con los modelos definitivos (Kenney).
- **Wizard**: multi-paso y preview 3D en vivo (hoy es un paso con preview 2D).
- **Modelos**: integrar el Kit de Kenney (lámpara de interior y más kinds); hoy solo silla/sofá reales.
- **flipX** sin escala negativa (normales); **toast** de error en el flush del wizard.
- **Auto-anclaje** de muebles a la pared más cercana (heurística), más allá del offset por modelo.

## Notas de la verificación
- Durante las pruebas quedaron zonas de prueba (Cocina prueba, Wizard v2) en el proyecto "Salón de
  ejemplo" y muros de prueba en la zona Principal; se **limpió** corriendo `bun run db:dev-seed`, que
  regenera los proyectos de ejemplo desde `examples.ts`. El salón volvió a 6 muros / 5,2×3,7 m.

## Preguntas abiertas
- Ninguna bloqueante. Las mejoras futuras están priorizadas arriba; el rasgo es usable end-to-end.
