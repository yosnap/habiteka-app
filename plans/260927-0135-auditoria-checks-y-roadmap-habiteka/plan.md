---
title: "Habiteka: auditoría de casillas y roadmap restante"
description: "Conciliación de planes históricos con código y entregas del 27-09-2026."
status: in_progress
priority: P1
created: 2026-09-27
---

# Habiteka: auditoría de casillas y roadmap restante

## Resultado visual confirmado por Paulo (27-09-2026)

Las tres imágenes nuevas fijan el nivel de presentación de una vivienda moderna terminada: fachada y volúmenes legibles, acristalamiento, materiales, iluminación, jardín, terraza y piscina cuando existan en el proyecto. Son referencias de acabado y encuadre, no el plano medido de un mismo inmueble ni una geometría navegable lista para importar. La imagen con dos plantas esquemáticas tampoco basta para reconstruir la casa mostrada sobre ellas.

La entrega deseada sigue este orden: **diseño 3D realista, editable y aprobado** → **visita libre dentro de ese diseño** → **vídeo automático de la misma versión**. En la visita, la persona decide por dónde caminar y mirar. En el vídeo, una cámara planificada muestra la construcción visual por etapas, vuela alrededor del exterior terminado como un dron y entra para hacer un paseo cinematográfico por el inmueble. La ruta guiada o su MP4 actual son una base técnica, no el resultado audiovisual final. Una imagen generada puede ayudar a decidir el estilo, pero la visita exige que acabados y objetos existan también en la escena 3D.

## Base y criterio de revisión

Referencia de ejecución: [flujo integral](../260924-1459-flujo-integral-plano-diseno-inmersion-video/plan.md), fases 1–7. Estado contrastado con `feat/diseno-aprobado-visita-video` en `1bed83d`, código, pruebas presentes, historial reciente y verificaciones de FInca documentadas en la fase 5. Esto es una revisión de alcance; no equivale a ejecutar toda la suite ni a una prueba nueva en móvil o con un inmueble importado fiel.

Antes de esta conciliación había **42 directorios con `plan.md`, 595 casillas y 308 marcadas** en sus archivos de fase. Once planes con estado `completed`/`done` tenían alguna casilla abierta: diez sin ninguna marcada y el F7 guiado con 23/27. Esos contadores mezclan generaciones antiguas del editor, aceptación de producto y pruebas manuales. Una casilla vacía en un plan terminado no demuestra por sí sola que falte código; una casilla marcada tampoco valida el Editor v2 actual. No se han marcado en bloque los planes históricos.

Se actualizó **una** casilla global del plan integral: las entradas del Estudio llevan al documento editable con estados y resultados comprensibles, según la fase 1 y las rutas de imagen/PDF/boceto de fase 2. Se corrigieron además el estado de fase 6 (trabajo iniciado), el texto obsoleto sobre vínculo de vídeo a la aprobación y el estado del [plan de inmersión anterior](../260924-1208-inmersion-diseno-aprobado/plan.md), ahora absorbido. Las otras ocho casillas globales permanecen abiertas porque sus condiciones completas aún no están verificadas.

## Lo hecho frente a las fases vigentes

| Fase | Comprobado | Falta para cerrarla |
| --- | --- | --- |
| 1. Estudio y resultados | Etapas, siguiente paso, galería, fuentes estables y correcciones de medidas recuperables; pruebas locales de navegación e integración. | Cotización exacta por modelo y generación real controlada con créditos. |
| 2. Importación y edición | Imagen, primera página PDF y boceto pasan por revisión y confirmación; avisos de escala/topología bloquean generación dudosa sin impedir corregir el plano. | La Original v11 aún tiene arcos/ventanas ausentes, estancias solapadas y cotas por confirmar. Comparación visual final y aplicación segura en proyecto aislado. |
| 3. Diseño aprobado y calidad | Plano técnico y visual cenital comparten `EditorDocument`/escena con el 3D; muebles se colocan, giran y apoyan sin el salto previo. Aprobación guarda revisión, huella, autor, luz y manifiesto. | Construir un acabado convincente de interior **y exterior** en la escena navegable: muebles, baños, fachadas, acristalamiento, texturas, cubierta, terreno y elementos existentes en el proyecto; comparar diez cámaras. Unificar catálogo y conservar binarios GLB/texturas por aprobación. |
| 4. Visita libre | Visita de solo lectura de una aprobación, libre/guiada, mini plano, escaleras, rampas, patios y laterales recogibles de carpas; rutas comparten colisiones. | Probar que se camina y mira libremente **dentro del diseño final aprobado**, por plantas y exterior de un inmueble fiel, con controles y rendimiento móvil. Añadir puntos de interés y propuesta de cambios desde la visita. |
| 5. Vídeo automático | Recorrido y montaje nativos de la misma aprobación, H.264/MP4; FInca rev. 94 produjo un MP4 real de 93,4 s, 1080p y 72.468.926 bytes, disponible en Diseños. | El MP4 existente no valida la pieza objetivo: faltan construcción visual por etapas, vuelo exterior tipo dron, revelación del inmueble terminado, entrada continua y paseo interior cinematográfico con editor/previa de tomas, 9:16, audio opcional y medidas de exportación. Vídeo IA solo tras comparar fidelidad, coste y continuidad. |
| 6. Entrega | Diseños permite reproducir/descargar el MP4 y abrir su visita exacta; Historial recupera revisiones del plano sin borrar la actual. | Prueba completa de un inmueble representativo, estados de resultados integrados, versión recuperable de todo el proyecto, política de compartir, métricas y pruebas por sector. |
| 7. Comercios | Existe `CatalogItem`, carga propia y base de marketplace. | Catálogo común con Editor v2/IA, identidad SKU/variante/activo, feed vivo, ficha y piloto con comercio autorizado. |

Evidencia principal: `src/components/plano-studio/studio-stage-nav.tsx`, `studio-results-panel.tsx`, `pdf-to-png.ts`; `src/server/plan/build-plan-import.ts`; `src/components/editor-v2/scene/editor-scene-view.tsx`, `offline-recorder.ts`; `src/server/editor/document-repo.ts`; `src/components/editor-v2/session/approved-design-view.tsx`; `src/app/(app)/projects/[id]/deliverables/page.tsx`. Las pruebas focalizadas están bajo `tests/server/plan-import-*`, `tests/server/editor-document-repo.test.ts`, `tests/editor-document/walkthrough.test.ts` y `tests/server/walkthrough-actions.test.ts`.

## Lectura de las nueve casillas globales

| # | Estado | Motivo de no cerrar lo restante |
| --- | --- | --- |
| 1. Entradas y estados del Estudio | Hecho; marcada | La fidelidad de la extracción es otra condición, en fase 2. |
| 2. Misma versión en diseño/visita/vídeos | Parcial | IDs, revisión y huella están enlazados; los GLB/texturas no se archivan por aprobación y una actualización podría impedir reproducir una visita antigua. |
| 3. Caminar todas las zonas | Parcial | FInca tiene una ruta válida sin bloqueos; faltan cobertura del inmueble patrón y prueba libre entre plantas/exterior sobre plano fiel. |
| 4. Montaje y paseo en formatos publicitarios | Parcial | MP4 horizontal funciona; faltan la secuencia cinematográfica de construcción, dron exterior y entrada/paseo interior, además de 9:16 y editor de tomas. |
| 5. Fidelidad y fluidez escritorio/móvil | Pendiente | Hay muestras sintéticas y prueba de escritorio; falta comprobar el acabado final compartido por maqueta, visita libre y vídeo en un inmueble real importado. |
| 6. Identidad única de catálogo e IA | Pendiente | Editor v2 y propuesta nativa aún leen `FURNITURE_CATALOG`; `CatalogItem` persistente vive en otra vía. |
| 7. Comercio vivo sin mutar la aprobación | Pendiente | Sin SKU/versiones canónicas ni feed de comercio autorizado. |
| 8. Tres usos de un mismo inmueble | Pendiente | Faltan tareas y métricas separadas de inmobiliaria, interiorismo y mueblería. |
| 9. Chat único seguro y medido | Parcial | Existe revisor del plano con aceptación/revisión; no un flujo único con catálogo, visita, guion de vídeo y presupuesto de contexto de entrada. |

## Roadmap priorizado

El orden respeta la prioridad de Paulo: **calidad visual compartida del plano visual y el 3D primero**; solo después se valida la visita libre y se dirige el vídeo cinematográfico sobre el diseño terminado. La aprobación, visita y exportación básicas ya están conectadas. La importación fiel avanza a la vez como puerta necesaria para afirmar que una propiedad real está bien representada. Ningún hito requiere publicar una visita sobre geometría bloqueada.

| Orden | Entrega concreta | Condición de salida y dependencia |
| --- | --- | --- |
| R1 · Diseño 3D terminado | Fijar inmueble patrón autorizado y matriz de cámaras cenital, oblicua, exterior e interior de día/noche; mejorar baño/sanitarios, mobiliario dominante, materiales, huecos, fachada, acristalamiento, cubierta y entorno existente en la **misma escena navegable**. Mantener arrastre, soporte, giro y medidas del plano visual. | Capturas comparables desde al menos diez cámaras y las tres vistas sin cambios de posición/identidad; el modelo terminado se reconoce igual desde exterior e interior. Inventario de activos exactos/aproximados; registrar carga y FPS. Puede empezar en muestra aislada. |
| R2 · Plano fiel y aprobación reproducible | Terminar revisión de Original v11 y un segundo plano distinto: puertas, ventanas, solapes y referencia de cotas; probar envío al editor solo en proyecto descartable. Archivar GLB/texturas usadas por cada aprobación y verificar reapertura tras cambios del catálogo. | Comparación visual contra originales y cotas revisadas, sin incidencias estructurales ni arcos omitidos aceptados en silencio. La aprobación antigua conserva modelo y aspecto aunque cambien los activos desplegados. Bloquea publicación fiel. |
| R3 · Catálogo y diseño verificable | Unificar catálogo propio, Editor v2 y propuesta IA por ID elegible, dimensiones, licencia, exactitud y versión de activo. Completar validaciones de aprobación y diferencia entre imagen IA y 3D. | Una pieza propia subida aparece en editor y puede ser propuesta por ID sin inventar SKU; colisiones/puertas comprobadas; lo aproximado se rotula y no se vende como producto exacto. Depende de R2 para prometer versionado estable. |
| R4 · Visita libre del diseño final | Recorrer el inmueble patrón **visualmente terminado y aprobado** por tres estancias, dos plantas y exterior; probar elección libre de dirección y mirada, puertas, carpas, rampas, mini plano y móvil. Añadir puntos de interés y enviar cambios solicitados a un borrador con revisión esperada. | Capturas comparables con R1, registro de pasos y bloqueos, carga/FPS/memoria y controles de escritorio/móvil; la visita aprobada no cambia al editar. Depende de R1–R3 para validar fidelidad real. |
| R5 · Película automática de construcción y dron | Usar el montaje actual de FInca como línea base. Crear storyboard y editor de tomas con previa: parcela/estructura, acabados y mobiliario por etapas, vuelo exterior tipo dron alrededor del inmueble terminado, transición por la entrada y paseo interior cinematográfico. Exportar 16:9 y 9:16, con audio opcional y atribución. | Ambas versiones proceden del diseño aprobado que se recorre en R4, con continuidad de geometría, muebles, luz y acabados; cámaras sin cruces físicos y transiciones revisadas. Registrar tiempo, tamaño y memoria. Solo entonces ensayar clips IA de Kie contra el MP4 fiel y decidir por datos. |
| R6 · Asistente único | Enrutar revisión de plano, acabados, muebles de catálogo, cambios desde la visita y guion de vídeo a operaciones tipadas con vista previa, aceptación y revisión esperada. Limitar contexto de entrada y registrar tokens, coste y latencia; evaluar Jev caído, proveedor fallido e instrucciones hostiles en fichas. | Ninguna orden modifica un diseño aprobado o consume vídeo de pago sin aceptación; conflicto de revisión y SKU inválido se rechazan; pruebas comparan calidad/coste con y sin Jev. Depende de R2–R3 y usa el editor de tomas de R5. |
| R7 · Entrega y pilotos | Unificar estados/versión/procedencia en Estudio y Diseños; versión recuperable del proyecto integral; decidir enlace externo autorizado. Probar flujo completo y tres tareas sectoriales con métricas propias. Preparar socio de mueblería y contrato de datos, sin publicar productos ajenos antes del acuerdo. | Reabrir plano, visita y vídeos correctos; permisos y recursos ausentes probados; feedback de cada sector registrado. Catálogo comercial vivo y enlaces llegan después de R3 y del acuerdo. |

### Primer bloque ejecutable

1. Capturar línea base de la muestra y escoger el inmueble patrón/cámaras; listar con capturas las diferencias de plano visual, 3D exterior e interior frente a las referencias. Priorizar fachada, acristalamiento, cubierta y entorno junto a baño, muebles y materiales que dominan la vista.
2. Repetir la extracción de Original v11 y revisar sobreimpresión de todos los arcos, ventanas, clósets, estancias y cotas; no aplicar a FInca ni a otro proyecto real mientras haya discrepancias.
3. Diseñar la retención de archivos GLB/texturas por aprobación y una prueba de reapertura histórica; la huella del manifiesto actual no conserva el binario.
4. Exportar el montaje «obra + visita» existente de la revisión 94 de FInca en entorno controlado y medir duración, tamaño, tiempo y memoria; usar el paseo MP4 de 93,4 s como referencia técnica, documentando qué tomas y transiciones faltan para el vídeo objetivo.
5. Hacer la primera medición de móvil y escritorio sobre la misma escena antes de aumentar el coste gráfico.

## Trabajo histórico que no debe duplicarse

- El [plan de inmersión del 24/09](../260924-1208-inmersion-diseno-aprobado/plan.md) queda **sustituido** por R1–R5 y fases 3–5 del integral. Sus seis casillas vacías no son seis tareas nuevas.
- Los F6/F7/F8 y la iluminación figuran en varios planes como `completed` con checks vacíos; sus implementaciones constan en código y reportes, pero esas casillas antiguas requieren una auditoría de aceptación propia si se pretende cerrarlas formalmente. No se han convertido en bloqueos automáticos del roadmap actual.
- El [MVP de junio](../260616-2004-habiteka-mvp-equipo/plan.md) conserva 26 checks abiertos: infraestructura (copias/PITR, alertas, staging), QA visual/a11y y pruebas de integración, evaluación con usuarios y algunos contratos legales/de tracking. Son **gates transversales de lanzamiento**, además de R1–R7; no están absorbidos por un MP4 exitoso.
- La [restructuración del editor](../260624-1752-restructuracion-editor-profesional/plan.md) tiene 40 checks abiertos, entre ellos PDF/alzados, enlace público, catálogo de tiendas y acciones 3D. La [réplica de construcción](../260908-0252-replica-construccion-planner5d/plan.md) tiene 42 checks sin marcar. Deben verificarse contra el Editor v2 vigente y fusionarse por función con R1–R7, evitando implementar dos caminos de exportación o compartir.
- El [historial recuperable](../260926-1837-versiones-recuperables-de-proyectos/plan.md) ya cubre revisiones del plano. La versión integral de Estudio, activos y entregables queda en R7.

## Preguntas sin resolver

1. ¿Qué inmueble y fotos autorizadas usar como patrón para medir fidelidad visual y métrica? Hasta elegirlo, R1 puede avanzar con la muestra aislada, pero R2/R4/R5 no pueden cerrarse.
2. ¿La visita aprobada se comparte solo dentro del equipo o habrá enlace revocable para clientes? Define la parte pública de R7.
3. ¿Qué duración, escenas y formato vertical debe tener la primera pieza publicitaria? R5 puede construir el editor de tomas y medir el montaje actual antes de fijar el preset.
4. ¿Qué comercio autoriza el primer piloto y qué uso de SKU, imágenes y GLB permite? R3 usa catálogo propio entretanto; R7 no declara piloto comercial sin acuerdo.
5. ¿Qué vídeo de referencia concreta el ritmo del vuelo, montaje y entrada? Paulo puede aportarlo; las tres imágenes ya bastan para iniciar el trabajo de calidad visual y guion sin elegir aún una casa real.
