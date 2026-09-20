---
title: "Réplica de construcción manual y espacio 3D"
description: "Plan aceptado; réplica en implementación y aceptación parcial, basada en observación Planner5D."
status: in-progress
priority: P1
branch: feat/editor-v2
created: 2026-09-08
tags: [editor, construction, ux, 3d]
---

# Construcción manual y espacio 3D

## Objetivo y frontera

Replicar el flujo de construcción observado: megamenú vertical, paredes, puertas, ventanas, escaleras, contextuales y habitación 3D coherente. Inicio aceptado por el usuario el 2026-09-08 («ok, continuamos con la réplica entonces no?»). La aprobación autoriza implementar, no equivale a aceptación final ni a funcionalidad terminada.
Smart Wizard, importación de planos e IA quedan fuera de esta iteración por la prioridad nueva del usuario. Sus accesos se documentan como referencia, sin botones que aparenten funcionar.
La petición nueva reactiva 3D para este alcance, aunque el plan anterior lo congelaba. No se modifica ni se declara completado aquel plan; persisten sus obligaciones de seguridad y guardado.

## Base inicial comprobada antes de implementar

Worktree: `habiteka/worktrees/habiteka-app-feat-editor-v2`; original sucio preservado.
Modelo `EditorDocument` en mm, vértices compartidos, huecos vinculados por `wallId`, historia y guardado CAS ya existentes.
Konva actual dibuja arrastrando un segmento; huecos se insertan por click, sin arrastre ni reasignación de pared.
Three, React Three Fiber y Drei ya están instalados; renderer legacy modular disponible, pero depende de `CanvasDoc` y píxeles.
No existe entidad escalera en v2. Faltan altura, elevación, modelo, materiales y sentido de apertura.

## Observación recibida y propuesta

[Auditoría detallada de interacciones y límites de evidencia](../reports/planner5d-interaction-audit-260908-0252-construccion-contextuales-3d-report.md).

Observado por agente principal en Comet: Construya en dos columnas; contextual de pared Estilo / Curved wall / Añadir esquina / Ocultar, con Length / Thickness abajo. Puerta 96×210 cm, elevación 0; acciones Estilo / Copiar / Centro / inversiones / favoritos / borrar. Reubicar puerta entre paredes conserva ancho y rota; aparecen cotas de separación 2,59 y 1,45.
Ventana 250×175 cm, elevación 45 cm: catálogo la coloca en centro, contextual Comentario / Estilo / Copiar / Centro / Favoritos / Borrar. Se observó highlight verde en pared inferior/derecha al arrastrar, pero NO se confirmó alojamiento final; quedó en centro. Otro modelo 164×220 cm, fondo 16 cm, era libre y quedó fuera. No inferir reglas de colisión ni éxito del snap.
Escalera U 300×216×304 cm, elevación/ángulo 0: contextual con inversiones y Girar, cotas hacia cuatro paredes. 3D orbitable observado con ladrillo exterior, blanco interior, suelo madera, puerta abierta con vano, peldaños/barandillas/descansillo y modelos ventana. Valores particulares de esos modelos, no defaults universales.
La captura del usuario prescribe cotas exteriores con doble flecha y texto centrado. Colores exactos, tamaños y comportamiento no capturado se fijarán con las evidencias de la inspección, nunca como datos medidos inventados.
Paredes encadenadas: se leyó tutorial, no se verificó creación real. Ventanas: los ensayos automatizados pueden no reproducir el gesto correcto; no atribuir un fallo al producto. 3D: órbita y zoom reales observados, no render IA.
Los contratos, componentes y criterios siguientes son propuestas Habiteka, no afirmaciones sobre código interno de Planner5D.

## Fases

| Fase | Entrega | Dependencia | Estado |
|---|---|---|---|
| [1](./phase-01-contratos-y-superficie.md) | Contratos y megamenú contextual accesible | Base v2 | Pending |
| [2](./phase-02-dibujo-de-paredes.md) | Cadena de paredes, uniones y cotas | 1 | Pending |
| [3](./phase-03-puertas-y-ventanas.md) | Catálogo, alojamiento y reasignación de huecos | 1, 2 | Pending |
| [4](./phase-04-escaleras-y-construcciones.md) | Escaleras editables y piezas constructivas | 1, 2 | Pending |
| [5](./phase-05-escena-3d-y-aceptacion.md) | Proyección 3D y aceptación integral Comet | 2, 3, 4 | Pending |

## Decisiones aceptadas para esta iteración

- Mantener stack. Compartir documento, selección y comandos; separar vista 2D/3D y gesto transitorio.
- Proyectar mm directamente a escena 3D; no convertir a legacy para recuperar proximidad ni escala por defecto.
- Contextuales DOM reutilizables, anclaje canvas→pantalla; no botones dibujados sin acceso por teclado.
- Conservar tokens de `docs/ux/design-system.md`; paleta de estados y cotas derivada de referencia. Adaptar estructura móvil, no miniaturizar el megamenú.
- Ningún cambio de modo muta geometría ni consume créditos. Ningún catálogo depende de activos privados extraídos de Planner5D.

## Gate de entrega

### Ampliación solicitada — aprobada 03:46; implementación y aceptación parcial

La petición añade tamaño/giro en centro/elevación, encaje espacial, pintura y comentarios persistentes. Incluye también previsualización de paredes y contorno, cotas y guías al arrastrar esquinas/vértices. Se conserva stack y documento compartido; hacen falta controles directos y un contrato ampliado:

- [Propiedades espaciales y acabados](./phase-06-propiedades-espaciales-y-acabados.md).
- [Transformación y colocación válida](./phase-07-transformacion-directa-y-colocacion-valida.md).
- [Comentarios y aceptación espacial](./phase-08-comentarios-y-aceptacion-espacial.md).

Fases 6–8 cuentan con implementación v4: controles de tamaño/giro/elevación, preview de vértices, colisiones, acabados y comentarios. La aceptación integral sigue abierta; no confundir código implementado con toda la matriz verificada. Amplían, no cancelan, las cinco fases anteriores.

[Fase 9: cierre inteligente y paredes curvas](./phase-09-cierre-inteligente-y-paredes-curvas.md), alcance autorizado 04:19. Cierre implementado y probado; curvas requieren revisión técnica detallada e implementación.

[Evidencia y reconciliación de las nueve fases a las 04:28](../reports/implementation-260908-0426-cierre-y-acabados-report.md).

### Criterio previo que se mantiene

Completar en Comet: construir contorno → insertar puerta y ventana → cambiar pared anfitriona → editar medidas → insertar escalera → 3D → volver 2D → deshacer/rehacer → recargar. Igualdad geométrica ≤1 mm, sin pérdida de IDs ni propiedades. Capturas, pasos y resultados ligados a revisión/fixture.
Pruebas unitarias, integración de guardado, typecheck, lint, build y pruebas visuales; ninguna etiqueta «perfecto» sin evidencia.

## Seguimiento de implementación — 2026-09-08 03:20

Las cinco fases tienen implementación parcial; ninguna ha superado todos sus criterios. Checklist de aceptación conservado abierto: 0/21 criterios cerrados, 0/5 fases aceptadas. No representa porcentaje de código escrito. La CLI disponible solo marca todas las casillas de una fase; no se fuerza cierre ni se modifica el estado a mano.
[Informe de reconciliación y pendientes](../reports/project-manager-260908-0320-replica-construccion-report.md).
Entregado en código: contrato v3 con lector v2, megamenú, trazo encadenado, alojamiento/reasignación de huecos, contextual y propiedades, escaleras recta/L/U, proyección 3D canónica. Evidencia del agente principal: puerta nueva reubicada superior→derecha, recarga y 3D; U interior X4000/Y2300 mm y captura 3D con habitación/puerta/ventana, undo Y920/redo Y2300 en Comet con «Sincronizado». Selección sobrevive modo y ACK; inspector añade selector «Elemento del plano» por teclado.
QA reportada actualizada: 923 pruebas aprobadas, 5 omitidas, 135 archivos aprobados; typecheck y lint del alcance sin errores. Lint global: 29 errores/16 avisos previos en archivos idénticos a HEAD. Build aislado aprobado Next 16/webpack, 25/25 páginas, `/tmp/habiteka-build-B3t2Cl`, sin detener dev. No se declara aceptación global con estos datos parciales.
Desviaciones pendientes de cerrar, no exenciones: wall_chain implementa esquina elegida y copia de escalera, aún sin evidencia final; móvil/foco, matriz geométrica completa, ciclos de modo/historia y rendimiento de órbita requieren evidencia. Escalera multinivel y pared curva no se ofrecen como capacidades terminadas.

## Preguntas pendientes

- Repetir prueba de ventana para confirmar contrato exacto de alojamiento final; observado highlight, no drop exitoso.
- Pared curva solicitada expresamente: pendiente revisar contrato geométrico detallado e implementar, no ofrecerla activa sin geometría real.
- Escaleras: documentar variantes inspeccionadas; subida a otra planta exige contrato de niveles y hueco de forjado, no simularlo con un mueble.

## Fuentes y limitaciones

[Planner5D](https://planner5d.com/es), inspección del agente principal; [guías de interfaz](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), accesibilidad y navegación; [Three.js](https://threejs.org/docs/), biblioteca existente.
Consultas ui-ux-pro-max realizadas; referencia explícita prevalece sobre recomendaciones genéricas. Ruta `.Codex/skills/ui-ux-pro-max` ausente; se usó `.agents/skills/ak-ui-ux-pro-max`. CLI de scaffolding no admite la carpeta exacta asignada: documentos creados acotadamente, sin cambiar puntero de plan ni índices.
