---
title: "Phase 7: Transformacion directa y colocacion valida"
status: todo
---

# Phase 7: Transformacion directa y colocacion valida

## Overview

Tiradores de tamaño, asa de giro continuo, encaje y prevención de interpenetraciones. Las propiedades espaciales dependen de fase 6; la previsualización de vértices puede implementarse antes con el contrato actual.

## Requirements

Girar sobre centro propio; entrada numérica y snap angular opcional. Cotas de separación a paredes durante selección/gesto.
Pegar a cara correcta de pared, no al eje: cama nunca dentro del grosor.
Puertas/ventanas nunca flotantes, fuera de host o superpuestas, tampoco al editar ancho.
Elevación no cambia tamaño. Solape en proyección 2D permitido cuando los volúmenes están separados verticalmente.

## Architecture

Helpers puros de centro/huella orientada/transformación/colisión. Preview transitorio y commit validado único por gesto.
Pointerdown conserva agarre; tiradores normalizan scale de Konva a medidas físicas, nunca guardar scaleX/scaleY.
Colisión: huellas orientadas + intervalos verticales, broad/narrow phase local; no topología global en cada frame.
Volúmenes de muro comparten vanos/dinteles/alféizares con 3D. Snap mide distancia a cara y elige candidato válido sin saltos.
Volúmenes simples por categoría para muebles: una caja completa de mesa no debe impedir una silla debajo. Contacto permitido; interpenetración bloqueada.
No física dinámica, gravedad ni certificación: elevar es acción explícita. No cambiar automáticamente la altura para resolver colisiones.
Verde válido; rojo con motivo inválido. Soltar inválido conserva posición confirmada.
Mismas reglas en drag, resize, rotate, inspector, copia y cambios de muro: ningún bypass numérico.
Históricos inválidos legibles y corregibles; no mover objetos ajenos silenciosamente.

## Related Code Files

### Previsualización de esquinas y vértices — ampliación solicitada

Diagnóstico: los círculos de vértice de `document-layer.tsx` solo ejecutan `onDragEnd`; durante el gesto no existe geometría candidata para las paredes.

- Al arrastrar, mostrar todas las paredes incidentes al vértice, aunque alguna no esté seleccionada, con su grosor y uniones; actualizar el contorno/suelo afectado y las aberturas alojadas según la misma geometría candidata.
- Mostrar longitudes con líneas de doble flecha, ángulos y guías de alineación horizontal/vertical con otros vértices; referencias paralelas/perpendiculares respecto a las paredes conectadas. Tolerancias constantes en píxeles a cualquier zoom.
- Diferenciar guía visual de encaje activado: señalar el destino cuando se aplica snap. Excluir el vértice arrastrado y las auto-proyecciones sobre paredes incidentes para evitar que se quede pegado a sí mismo.
- Mantener el candidato transitorio, sin modificar documento canónico ni historial en cada movimiento. Reutilizar cálculo local y medir el coste del contorno de habitación.
- Mostrar en rojo el candidato inválido y su motivo: degeneración, cruces no admitidos, vanos fuera de rango o conflictos espaciales. No fusionar vértices ni cambiar topología silenciosamente por proximidad.
- Soltar confirma exactamente el candidato válido con un único comando; Escape, pointercancel, cambio de modo o readonly restauran el estado inicial completo.

Pruebas previstas: esquina L y unión T compartida, paredes oblicuas, abertura cerca de esquina, zoom variable, cruce inválido, cancelación y múltiples movimientos con una sola entrada de undo. En Comet capturar antes, durante y después del gesto, verificando que las paredes y las cotas siguen el puntero, no solo el círculo.

### Archivos afectados

Worktree: src/canvas/editor-v2/{editing-operations,opening-placement,store}.ts; nuevos spatial-transform.ts/placement-constraints.ts; componentes document-layer,stair-layer,opening-layer,inspector,selection-properties-bar,canvas-selection-menu; nuevo selection-transform-controls.tsx; tests/canvas.

## Implementation Steps

1. Casos OBB rotada, esquina oblicua, cama/muro, objetos separados en altura, abertura en esquina.
2. Resolver único de snap/colisión, mismo resultado preview/drop.
3. Tiradores, asa, elevación y cotas verdes a caras interiores; tolerancias constantes en pantalla.
4. Escape/pointercancel/modo/readonly cancelan provisional sin historia.
5. Contextuales accesibles y foco no interfieren con gestos.
6. Comet + 200 elementos: medir p95 de interacción y corregir trabajo derivado costoso.

## Success Criteria

- [ ] Mueble/escalera resize y giro sin saltos; centro estable y medidas 3D/recarga equivalentes.
- [ ] Cama no invade muro al mover/girar/redimensionar ni editar números.
- [ ] Aberturas respetan anfitrión, dimensiones, alturas y holguras.
- [ ] Objetos a distinta altura pueden compartir huella; interpenetración real se rechaza con motivo.
- [ ] Un undo por gesto; Escape restaura; readonly bloquea mutación.
- [ ] Snap/cotas correctos con paredes oblicuas y objetos rotados.
- [ ] Arrastrar un vértice previsualiza todas sus paredes, contorno y aberturas, con cotas y guías en vivo; el resultado al soltar coincide y Escape restaura todo.

## Risk Assessment

Evidencia parcial 04:30: controles directos y preview implementados; pruebas previas Comet resize/giro central y arrastre vértice. Cierre automático adicional en fase9. Mantener criterios compuestos abiertos hasta cubrir cancelación nativa, abertura resize y matriz completa. Véase informe `../reports/implementation-260908-0426-cierre-y-acabados-report.md`.

AABB global causa falsos positivos al rotar: usar huella orientada. Cajas rígidas de mesa fallan con sillas: proxies por categoría y fixtures de anidación legítima. Restricciones nuevas no deben bloquear corrección gradual de proyectos históricos.
