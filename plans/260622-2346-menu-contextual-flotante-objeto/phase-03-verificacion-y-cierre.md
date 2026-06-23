# Fase 3 — Verificación y cierre

## Requisitos
Confirmar que el menú flotante funciona end-to-end sin regresiones y dejar el plan cerrado.

## Validación automática
- `bunx vitest run` — suite completa verde (incluye el nuevo test de anclaje).
- `bunx tsc` — sin errores de tipos.
- eslint sin errores nuevos (especial atención a la regla no-use-effect).
- build limpio.

## Verificación en navegador real (manual)
1. Seleccionar un mueble → la barra de iconos aparece anclada SOBRE su bounding box.
2. **Duplicar** → crea copia (mismo efecto que clic derecho → Duplicar).
3. **Girar 90°** → rota el objeto; el menú sigue centrado sobre el nuevo AABB.
4. **Voltear** → voltea el objeto.
5. **Eliminar** → borra; el menú desaparece (sin selección).
6. **Zoom + pan** → el menú sigue pegado al objeto.
7. **Multi-selección** (marquesina sobre varios) → menú sobre el AABB del conjunto; acciones
   operan sobre todos.
8. **Borde del lienzo** → objeto pegado arriba: el menú cae debajo (clamp); pegado a un lado:
   no se sale (clamp horizontal).
9. **Clic derecho** → el menú contextual de siempre sigue funcionando igual (sin regresión).

## Cierre
- Marcar fases y `plan.md` como `completed`.
- Reporte breve en `plans/reports/` con: qué se entregó, decisiones (alcance acotado: 4 acciones,
  sin material/resize), y deuda futura anotada (p.ej. acciones de material cuando exista UI de
  material por objeto; el icono "✨ IA" de Planner5D queda fuera de alcance).
- Actualizar la memoria del proyecto (entrada del roadmap Planner5D: Tier 1.4 hecho).

## Riesgos / rollback
- Riesgo principal: el menú se desincroniza del objeto al rotar (pivote esquina vs centro). Mitigado
  por usar el AABB rotado correcto en Fase 1 (mismo criterio que `doc-to-scene`). Si aparece, el
  test de anclaje con rotación lo expone.
- Rollback: el menú flotante es aditivo (componente nuevo + lectura de selección); revertir el
  render en `canvas-stage.tsx` deja todo como estaba (clic derecho intacto).
