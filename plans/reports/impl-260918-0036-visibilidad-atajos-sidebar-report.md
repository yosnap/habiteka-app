# Implementación — Visibilidad, atajos y sidebar del editor

**Fecha:** 2026-09-18  
**Estado:** completado

## Resultado

El editor v2 incorpora un menú pequeño y centrado en la cabecera. Desde ese menú se puede:

- ocultar paredes o muebles;
- mostrar todas las cotas, solo las cotas exteriores o ninguna;
- activar y desactivar los atajos de teclado.

Las cotas exteriores se calculan con los muros que pertenecen a una sola estancia; las cotas
de muros compartidos se consideran interiores. Las cotas manuales se omiten en el modo
«Solo exteriores» para evitar mezclar medidas sin clasificación geométrica.

Los atajos operativos son S (selección), B (muro), R (habitación), D (puerta), V (ventana),
H (hueco), M (medir), F (catálogo de muebles) y Esc (cancelar). También se conservan los
atajos de edición Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, copiar, pegar, seleccionar todo, borrar y
flechas para desplazar. Se ignoran cuando el foco está en un input, textarea, select o editor
de texto.

El catálogo de muebles se ha movido al lateral izquierdo y comparte posición con el panel de
construcción, reduciendo el cambio visual entre herramientas.

## Validación

- `bun run typecheck` ✅
- `bun run build` ✅ (avisos existentes de credenciales OAuth en entorno local)
- pruebas dirigidas de editor/documento ✅
- validación visual en navegador: menú, ocultación de muebles, atajo B y apertura de catálogo ✅

La suite completa mantiene fallos previos de entorno (Prisma/gateway) y un fixture de
`wall-split` no relacionado con este cambio.

## Archivos principales

- `src/components/editor-v2/visibility-menu.tsx`
- `src/components/editor-v2/visibility-menu.module.css`
- `src/components/editor-v2/document-layer.tsx`
- `src/components/editor-v2/canvas-view.tsx`
- `src/components/editor-v2/editor-shell.tsx`
- `src/components/editor-v2/editor.module.css`
