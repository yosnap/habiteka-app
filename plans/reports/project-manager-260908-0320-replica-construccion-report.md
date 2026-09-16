# Réplica construcción — reconciliación de entrega

## Adenda verificada · 03:28

- Última suite completa: **928 aprobadas, 5 omitidas**, 136 archivos aprobados/4 omitidos; lint del alcance limpio.
- Añadir esquina en punto elegido y copiar escalera implementados; 13 pruebas focalizadas correctas. El atajo de división al 50 % sigue disponible en inspector, ya no sustituye el gesto nuevo.
- Comet: después de recargar, escalera U mantiene X=4000/Y=2300 mm. Copiar genera otra a X=4300/Y=2600; deshacer deja únicamente la original.
- Comet: activar Añadir esquina muestra instrucciones; Escape vuelve a selección sin modificación ni revisión pendiente. Confirmación por ratón todavía pendiente de ensayo visual.
- Escalera interior, puerta y ventana visibles en 3D; undo/redo y recarga comprobados. Ventana nueva y matriz completa móvil/gestos/rendimiento permanecen abiertas.
- Build aislado aprobado antes del último añadido de esquina/copia; esos últimos cambios tienen typecheck/lint y suite completos, no un segundo build registrado.
- Documentación vigente en `docs/editor-construction.md` y onboarding; arquitectura global preservada. No commit ni publicación.

La tabla siguiente conserva la reconciliación anterior como trazabilidad; esta adenda actualiza las carencias de implementación de esquina y copia, no cierra los criterios compuestos del plan.

Fecha: 2026-09-08 03:20. Plan: [construcción y 3D](../260908-0252-replica-construccion-planner5d/plan.md). Rama de código: `feat/editor-v2`, worktree separado. Usuario aprobó inicio; aceptación final pendiente.

## Progreso contra compromiso

0/21 criterios de aceptación cerrados; 0/5 fases completas. Implementación parcial en las cinco fases. Criterios compuestos se conservan abiertos: no confundir código disponible o tests unitarios con aceptación E2E.

| Fase | Implementación/evidencia | Falta para cierre |
|---|---|---|
| 1 | Contrato v3, lector v2, migración explícita, megamenú, contextual, propiedades | Persistencia E2E de todos los campos, foco, teclado, bordes/móvil, modos sin revisiones |
| 2 | Cadena por clic, snap 12 px, T atómica, cierre ID compartido, cotas con flechas | Esquina en punto elegido; matriz geométrica completa, arrastre y recarga |
| 3 | Resolver único, agarre conservado, holgura, rehost y copia; puerta superior→derecha + recarga + 3D por root | Nueva ventana, recorrido inverso medido, undo/flips, cancelación y solape E2E |
| 4 | Escaleras recta/L/U; U interior X4000/Y2300, 3D y undo Y920/redo Y2300 reales | Copiar/girar y matriz de parámetros tras recarga |
| 5 | 3D canónico, habitación/puerta/ventana/escalera visibles; build aislado aprobado | Gates compuestos: fixtures, ciclos completos, resiliencia, accesibilidad y rendimiento |

## Calidad y evidencia

- Última QA comunicada por root: 923 pruebas aprobadas, 5 omitidas; 135 archivos aprobados. Sustituye corrida de 913. No se ejecutó suite duplicada por PM.
- Typecheck y lint del alcance: 0 errores. Lint global: 29 errores/16 avisos en archivos idénticos a HEAD; deuda anterior, no gate global verde.
- Tests leídos por PM: `construction-contract`, `construction-integration`, `editor-v2-wall-drawing`, `editor-v2-opening-placement`, `editor-v2-scene`.
- Browser por root: nueva puerta, arrastre superior→derecha, recarga y habitación 3D con puerta/ventana. U dentro de habitación en X4000/Y2300 mm y captura 3D conjunta. Undo Y920/redo Y2300 comprobados en Comet, estado «Sincronizado»; selección sobrevive cambio de modo y ACK. No equivale aún a 20 cambios/50 undo.
- Inspector incorpora selector «Elemento del plano» operable por teclado; validación integral de accesibilidad pendiente.
- Revisión corrigió coste de preview, salto de agarre, orientación implícita v2 y holgura de esquinas. Rebenchmark resolver: 200 muros ≈0,234 ms; 500 ≈1,12 ms. No es p95 de interacción ni FPS orbital.
- Build aislado aprobado: Next 16, webpack, 25/25 páginas, directorio temporal `/tmp/habiteka-build-B3t2Cl`; servidor dev no detenido ni `.next` compartido sobrescrito.

## Alcance y riesgos actualizados

| Asunto | Estado / impacto | Responsable y salida |
|---|---|---|
| Cambio frente a plan anterior | 3D reactivado; importación/IA/Smart Wizard fuera de esta iteración, no cancelados globalmente | Root: conservar obligaciones de guardado y seguridad del plan anterior |
| División de pared al 50 % | Agente wall_chain implementando esquina por punto; aceptación pendiente | wall_chain/Root: gesto de punto, protección del vano y evidencia UI |
| Copia de escalera | Agente wall_chain implementando; sin evidencia de cierre todavía | wall_chain/Root: copia válida + undo + recarga |
| Comet compartido | Coordinación foreground; usuario está utilizando navegador | Root: usar sesión autorizada/background y pedir turno antes de interacción foreground |
| HMR/WebGL | Pérdida de contexto observada, recarga recupera; resiliencia no cerrada | Root: probar recuperación y mantener 2D disponible |
| Pruebas finales | Build resuelto; matriz móvil, ciclos completos y estrés aún sin evidencia | Root/QA: ejecutar y ligar resultado a cada criterio |
| Esquema v3 | Tests cierran pérdida silenciosa/downgrade; falta E2E completo de propiedades | Root/QA: persistir/reabrir puerta, ventana y escalera con campos editados |

No bloqueo confirmado de más de una sesión en esta iteración; sí deuda previa de lint. No ocultar estas carencias cerrando el plan por volumen de cambios.

## Próximas acciones con definición de terminado

1. wall_chain/Root: finalizar esquina elegida y copiar escalera; tests de comandos, cancelación/undo y UI real.
2. Root/QA: insertar y reubicar nueva ventana, girar/copiar escalera y recargar; IDs, medidas y anfitrión conservados ≤1 mm. Colocación interior y 3D ya comprobados.
3. Root/QA: ejecutar matriz pendiente de fase 5 y consola final; build aislado ya aprobado, registrar límites sin extrapolar.
4. Root/docs: documentar contrato v3, migración explícita y flujo de construcción en la superficie técnica propietaria; impacto documental real, no mera actualización de estado. PM no modifica `docs/` por ownership.
5. Root/PM: reconciliar las cinco fases después de evidencia final. Es importante terminar el plan completo y sus tareas pendientes; no declarar réplica terminada con gates abiertos.

## Preguntas pendientes

- Referencia: confirmar alojamiento final de ventana en Planner5D; ensayo anterior solo acreditó highlight.
- Curvas y conexión multinivel: requieren alcance/contrato adicional si se solicitan; no se ofrecen ahora como funcionalidad completa.
