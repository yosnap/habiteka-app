# Conservación del exterior en diseños cenitales

## Problema comprobado

La referencia técnica utilizada para generar la cenital completa omitía terrenos
y cerramientos. Los vehículos se dibujaban como rectángulos marrones; el prompt
corto solo describía muebles dentro de estancias. El resultado podía interpretar
el exterior como arena y los coches como bloques de madera.

## Corrección

- Inventario canónico de superficies, suelos exteriores, cercos y objetos;
  conserva materiales, especies/modelos, huellas, medidas, orientación y puertas.
- Referencia con albedos locales, capas, suelos interiores diferenciados,
  cerramientos con huecos reales y vehículos reconocibles. Encierra todo el terreno
  y las puertas abiertas del cerco en el encuadre.
- Prompt cenital v3 con exterior, contexto espacial e instrucciones por cámara.
- Auditoría v4 por ID, con categoría observada, identidad/geometría y acabado;
  omisiones y fallos concretos prevalecen sobre un resumen favorable. Césped
  visible, cercos y vehículos no pueden declararse ocultos en la cenital completa.
- Capas totalmente cubiertas se detectan mediante diferencia de polígonos.
- Informe exterior visible en el visor; compatibilidad con informes históricos
  y esquema de proveedor estricto.
- Guía de imágenes, novedades, arquitectura y documentación técnica actualizadas.

## Comprobaciones

- 125 pruebas en 12 archivos relacionadas con referencias, prompts, zonas y auditoría.
- Tras ajustar el esquema estricto: 53 pruebas de exterior y auditoría en 3 archivos.
- TypeScript, ESLint de archivos afectados y `git diff --check` correctos.
- `npm run docs:updates` y `npm run docs:build` correctos; Astro sin diagnósticos.
- Referencia sintética inspeccionada: `exterior-261005-1959-referencia.png`.
  Césped texturado, interior blanco, puerta de cerco abierta y dos vehículos.

## Límites reales

No se ha llamado a un generador IA ni se ha aceptado ningún diseño por el usuario.
La prueba de auditoría usa un doble de visión; no demuestra la fidelidad de una
imagen fotográfica nueva. La imagen mostrada por el usuario sigue sin reparar y
los informes anteriores no se actualizan retrospectivamente. La referencia
sintética es técnica, no un diseño final ni una alternativa para vídeo.

Se conservan los cambios anteriores y el borrador original del navegador.
Sin commit, despliegue ni gasto de generación.
