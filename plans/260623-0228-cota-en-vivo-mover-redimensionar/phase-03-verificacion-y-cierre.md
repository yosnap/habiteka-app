# Fase 3 — Verificación y cierre

## Validación automática
- `bunx vitest run` — suite completa verde (incluye `live-dimensions.test.ts`).
- `bunx tsc` — sin errores.
- eslint sin errores nuevos (atención a no-use-effect).
- `next build` limpio.

## Verificación en navegador real (Playwright, dev-login, proyecto con muebles)
1. **Redimensionar** un mueble con el Transformer → aparece "ancho × fondo" en metros, se actualiza
   en vivo, desaparece al soltar.
2. **Mover** un mueble → aparecen las distancias a vecinos/paredes en X e Y, se actualizan al
   arrastrar, desaparecen al soltar.
3. **Sin vecino** en un lado → no aparece esa cota (o mide a la pared si hay bounds).
4. **Multiselección** → mide el conjunto.
5. El store solo cambia al soltar (undo deshace el gesto completo, no frame a frame).
6. Sin regresión: drag/resize siguen colocando el objeto donde corresponde; el menú flotante sigue
   oculto durante el drag y reaparece al soltar.

## Cierre
- Marcar fases y `plan.md` como `completed`; criterios `[x]` (los verificables).
- Reporte breve en `plans/reports/`.
- Actualizar memoria (roadmap Planner5D: Tier 1.3 hecho).

## Riesgos / rollback
- Riesgo: ruido de cálculo por frame en proyectos con muchos objetos. Mitigación: `neighborGaps`
  es O(n) por frame sobre el AABB; suficiente. Si se nota, limitar a los vecinos de la zona activa.
- Rollback: el overlay y el estado `live` son aditivos; quitar los handlers `onDragMove`/`onTransform`
  y el componente deja el comportamiento actual intacto.
