# Reporte — Menú contextual flotante sobre el objeto (Tier 1.4 Planner5D)

**Fecha:** 2026-06-22 · **Rama:** `feat/canvas/menu-flotante-objeto` · **Estado:** implementado (pendiente verificación manual en navegador).

## Qué se entregó
Barra flotante de iconos anclada SOBRE el objeto seleccionado (patrón Planner5D), aparece al
seleccionar sin necesidad de clic derecho. Acciones: Duplicar · Girar 90° · Voltear · Eliminar.

## Archivos
- `src/canvas/floating-menu-anchor.ts` (nuevo) — lógica pura: AABB rotado, mundo→pantalla, anclaje
  con placement top/bottom y clamp. Konva rota sobre la esquina (`x,y`), no el centro → AABB rota
  las 4 esquinas sobre (x,y), mismo criterio que mantiene 2D/3D alineados.
- `tests/canvas/floating-menu-anchor.test.ts` (nuevo) — 11 tests (AABB con/ sin rotación, multi,
  worldToScreen, placement arriba/abajo, franja reservada, clamp horizontal).
- `src/components/canvas/floating-object-menu.tsx` (nuevo) — UI: iconos SVG inline (sin librería
  nueva), `aria-label`/`title`, reusa acciones del store vía `useCanvasStore.getState()` (mismo
  patrón que `buildMenuItems`).
- `src/components/canvas/canvas-stage.tsx` (mod) — anclaje DERIVADO del render (no efecto); flag
  `dragging` (onDragStart/onDragEnd) oculta el menú durante drag/pan; Escape deselecciona.

## Decisiones
- **Alcance acotado (YAGNI):** 4 acciones. Sin material/resize/IA (no hay UI de material por objeto
  hoy; el icono ✨ de Planner5D queda fuera).
- **Ajustes del predict aplicados:** (1) ocultar menú durante drag/pan y reposicionar al soltar —
  elimina el coste de recalcular AABB por frame; (2) preferir el AABB nativo de Konva valorado, se
  optó por helper puro testeable; (3) Escape deselecciona; (4) clamp con franja reservada.
- El clic derecho (`context-menu.tsx`) queda intacto; ambos coexisten (z-40 flotante vs z-50 fixed).

## Verificación
- `bunx tsc` ✅ · `eslint` ✅ · `bunx vitest run` ✅ 490 passed / 2 skipped · `next build` ✅.

## Pendiente (verificación manual del usuario)
- Seleccionar mueble → menú encima → duplicar/girar/voltear/borrar; zoom/pan sigue al objeto;
  multi-selección sobre AABB del conjunto; clamp en bordes; clic derecho sin regresión.

## Deuda futura anotada
- Acción "cambiar material" cuando exista UI de material por objeto.
- Acción ✨ IA contextual (estilo Bernard) si se reubica el chat in-editor (Tier 4.18).
