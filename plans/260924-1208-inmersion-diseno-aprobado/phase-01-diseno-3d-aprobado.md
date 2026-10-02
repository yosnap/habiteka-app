---
title: "Fase 1: Diseño 3D aprobado y cobertura"
status: todo
---

# Fase 1: Diseño 3D aprobado y cobertura

## Objetivo

Convertir la aceptación del diseño en una versión coherente y verificable del inmueble completo, apta para cualquier cámara.

## Situación y decisión

- `EditorDocument` ya contiene geometría, acabados, luces y muebles por planta. `applyNativeDesignProposal` aplica al documento acabados y muebles aceptados.
- «Crear imágenes» genera entregables por vista, sin modificar ese documento. `storyboardImages` asocia imágenes a puntos de ruta, pero no aporta geometría ni texturas proyectables de forma fiable.
- La fuente de la inmersión será una versión aprobada del documento 3D. Los renders IA serán referencias visuales y entregables, nunca piezas pegadas como paredes o suelos. Si el diseño solo existe como imágenes, habrá que traducirlo a materiales y objetos estructurados y revisarlo antes de habilitar la visita.

## Trabajo

1. Definir aprobación explícita de versión en el proyecto: revisión del documento, plantas incluidas, diseño visual elegido, fecha y autor. Mantener el documento editable, pero invalidar la aprobación para publicar una nueva visita cuando cambie geometría, materiales, muebles o iluminación.
2. Añadir una comprobación de cobertura sobre `buildingDocuments`: estancias cerradas, suelo/techo, acceso por puertas, mobiliario con representación 3D, materiales e iluminación. Separar bloqueos reales (geometría no transitable) de avisos visuales.
3. Recomendar vistas interiores adicionales por estancia desde la escena aprobada: entrada, zonas grandes y puntos con ángulos muertos; comparar con los renders asociados. No pedir imágenes adicionales para «rellenar» la geometría. Mostrar discrepancias de muebles, acabados o huecos para corrección en el documento.
4. Conservar referencias a imágenes aprobadas por pose y revisión como guía del acabado, sin exigirlas para cada punto del paseo. Para las imágenes IA que añaden decoración no editable, ofrecer conversión supervisada a objetos de catálogo o mantenerlas fuera del recorrido 3D.

## Código afectado (orientativo)

- `src/lib/editor-document/native-design-proposal.ts`, `building-levels.ts`, `walkthrough-storyboard.ts`.
- `src/components/editor-v2/editor-generate-dialog.tsx`, `storyboard-panel.tsx`, `editor-shell.tsx`.
- Persistencia del proyecto/entregable: definir contrato de versión antes de tocar Prisma y acciones de servidor.

## Verificación

- En un proyecto de varias estancias, aprobar un diseño aplicable produce una sola escena con materiales y muebles estables al cambiar de cámara.
- Una imagen aislada no habilita por sí sola «Publicar inmersión»; se explica qué elementos faltan en 3D.
- Una edición posterior muestra que la visita publicada corresponde a la revisión anterior y requiere nueva aprobación para actualizarla.

## Riesgo

La correspondencia entre un render generativo y los objetos del plano puede fallar. Señal: discrepancias visibles en dos o más cámaras. Respuesta: revisión estructurada antes de publicar; no interpolar las imágenes como sustituto de la escena.
