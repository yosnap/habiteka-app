# UX del constructor: propiedades y selección

## Alcance de esta ronda

- Continúa el handoff `handoff-261002-1956-ux-constructor-report.md`. Conserva los cambios locales de constructor y Vídeos anteriores.
- Propiedades mantiene el buscador y se actualiza al seleccionar desde el lienzo. Elegir un resultado ya no cierra el panel.
- Medidas, Acabados y Notas agrupan la edición disponible. Paredes y muebles separados en componentes; dimensiones antes que posición, giro y acciones. Huecos conservan centrado, ocupación del muro, copia y apertura.
- Barra inferior de resumen; sin controles duplicados de medidas. Menú radial oculto mientras Propiedades está abierto.
- Selección múltiple: solo campos comunes; selección mixta o no compatible permite elegir un elemento. Aviso explícito de valores del primer elemento. Eliminación de una habitación interior deshabilitada; editar sus paredes cambia el contorno.
- Mantiene los tokens del constructor, Geist Sans, alineación izquierda, color de marca para estados activos y rojo reservado a eliminar. Navegación antes de contenido; medidas antes de acciones.

## Verificación

- 71 pruebas en 9 archivos: selección, paneles, cambios conjuntos, índice, atajos, construcción, acabados y colocación espacial. Pruebas en memoria; URL local autorizada de pruebas para el guard, sin conexiones ni reinicios de BD.
- TypeScript, ESLint de archivos afectados y `git diff --check`: correctos.
- `npm run docs:updates` y `npm run docs:build`: correctos, 17 páginas.
- Next.js con webpack: compilación, TypeScript, páginas y empaquetado correctos en copia aislada. La copia requirió incorporar el cliente Prisma generado y ajustar allí `outputFileTracingRoot` para dependencias enlazadas desde otro volumen. No cambia `next.config.ts` del repositorio. Avisos de proveedores sociales sin credenciales locales, ajenos a esta ronda.
- CUA nativo en muestra aislada: pared, puerta, habitación y sofá; búsqueda persistente; altura con coma decimal y deshacer; rechazo de ancho que invade esquina; acabados y notas integrados; selección mixta de 41 elementos y propiedades comunes de 12 paredes. Apertura de Propiedades en Modelo 3D.
- Zoom del navegador a 175 % y 400 %: reflujo y controles accesibles desplazando el panel. Restaurado a 100 %. No equivale a prueba táctil ni móvil físico.
- Un aviso de recarga CSS de Turbopack tras retirar estilos antiguos desapareció al recargar; verificación final sin ese aviso.

## Estado y continuidad

- Guía de herramientas y novedades actualizadas en `docs/site/src/content/docs/`.
- Ninguna generación o aceptación IA. Ediciones de prueba solo en la muestra; deshechas. Sin commit, merge ni despliegue.
- Siguiente bloque: lienzo y vistas. Revisar encuadre con panel abierto, cambios de vista durante una tarea y colocación. Actualmente cambiar de vista cierra el panel; puede reabrirse con la selección conservada.
- Después: Diseños, generación, Vídeos completos y revisión transversal de accesibilidad. No se consideran terminados por esta ronda.

## Preguntas pendientes

Ninguna necesaria para continuar con lienzo y vistas.
