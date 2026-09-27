---
title: "Fase 6: Entrega y validación integral"
status: pending
---

# Fase 6: Entrega y validación integral

## Avance comprobado (27-09-2026)

«Diseños» muestra el MP4 real de «Recorrido Paulo», permite descargarlo y enlaza con la revisión 94 aprobada. «Historial» permite previsualizar y recuperar revisiones del plano sin borrar la actual. Esto inicia la entrega, pero no completa la prueba integral con un plano importado fiel, varias plantas y móvil; tampoco existe aún una versión recuperable de todo el proyecto ni un enlace público de visita para clientes. Véase el [roadmap reconciliado](../260927-0135-auditoria-checks-y-roadmap-habiteka/plan.md).

## Objetivo

Hacer que el proyecto conserve y presente con claridad plano, diseño aprobado, visita y vídeos, y verificar el recorrido completo.

## Trabajo

1. Unificar el acceso a resultados desde el Estudio y «Diseños»: original y redibujados como fuentes, documento/vistas como versiones de trabajo, visita publicada y vídeos como salidas finales. Mostrar procedencia, fecha, versión, estado y acciones aplicables.
2. Separar «Aprobar internamente» de «Compartir visita» en el contrato. Hasta decidir publicación externa, la visita sigue accesible al equipo; si se comparte, generar enlace autorizado que no exponga documentos editables ni URL caducadas.
3. Ejecutar una prueba de extremo a extremo con el mismo inmueble: PDF o imagen → medidas → Editor v2 → diseño aplicado y renders → aprobación → visita por varias plantas → vídeo de montaje/paseo → descarga/reapertura.
4. Validar con pruebas focalizadas los estados de UI, PDF, persistencia/versionado, permisos por organización, navegación y colisiones, ruta y MP4. Añadir verificación visual en navegador de escritorio y móvil; medir rendimiento y tamaño de activos.
5. Documentar los límites reales del resultado: qué deriva de geometría aprobada, qué es interpretación visual IA y qué se ofrece como vídeo publicitario. Registrar incidencias detectadas antes de abrir la visita a clientes.
6. Mostrar en cada diseño/visita/vídeo la lista trazable de elementos del catálogo usados, su origen y si la representación es exacta o aproximada. Preparar ficha de producto consultable; los enlaces/precios de comercios solo se activan cuando existan datos y permisos vigentes.
7. Evaluar tres tareas sobre el mismo núcleo: anuncio/visita inmobiliaria, propuesta de interiorismo aceptable por cliente y estancia de mueblería con productos para consulta/presupuesto. Registrar tiempo, bloqueos, fidelidad y acción comercial por separado. La tercera tarea puede ensayarse con catálogo propio para validar UX, pero no cuenta como piloto comercial hasta disponer de socio y SKU autorizados.
8. Probar el asistente único de extremo a extremo: revisión de plano, cambio de acabado, mueble de catálogo, petición estructural, cambio desde visita y guion de vídeo. Incluir conflicto de revisión, ausencia de Jev, fallo del proveedor, instrucción hostil dentro de una ficha de catálogo y límites de contexto; comparar coste/latencia y calidad con el flujo actual de botones.

## Código afectado

- `src/app/(app)/projects/[id]/deliverables/page.tsx`, `src/components/deliverables/deliverables-panel.tsx`, `src/components/plano-studio/`.
- Acciones/repositorios de entregables y almacenamiento actuales; pruebas de UI, servidor, geometría y vídeo.

## Criterios de aceptación

- Se puede reabrir el proyecto y localizar cada resultado con su origen, versión y estado, sin confundir imagen con visita.
- La visita y vídeos son coherentes con el diseño aprobado; modificaciones posteriores no los alteran silenciosamente.
- La prueba completa funciona con un inmueble de varias estancias, dos plantas y exterior; los fallos de calidad muestran una reparación concreta.
- Se registran carga inicial, fluidez y tiempo de exportación del equipo de referencia antes de considerar terminada la entrega.
- La entrega identifica los productos usados sin confundir referencias visuales, modelos exactos, stock y precio actual.
- Existe evidencia separada de utilidad para inmobiliaria, interiorista y mueblería; no se declara validado un sector por el éxito de otro.
- Ningún comando conversacional aplica una propuesta sobre revisión obsoleta, salta permisos o gasta en vídeo sin confirmación. Cada cambio aceptado se reabre y puede deshacerse; entrada y salida de modelos quedan dentro de presupuesto registrado.

## Riesgos

Las URL firmadas, permisos de proyecto y versiones del documento son contratos compartidos entre Estudio, Editor y entregables; deben verificarse juntos antes de publicar.
