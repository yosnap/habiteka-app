# Instrucciones del repositorio

- Habla siempre en español.
- Los archivos no deben superar 1000 líneas salvo necesidad importante. Fragmenta componentes y scripts manteniendo buenas prácticas. Los lockfiles generados son una excepción.
- Edita con parches/diffs; no reescribas archivos completos.
- Para una tarea especificada, usa un agente. Fan-out máximo 3 solo en tareas ambiguas y cuando la sesión permita delegación.
- No superes 200.000 tokens de contexto; resume antes. No cruces 272K.
- No cambies el prompt de sistema ni el orden de herramientas a mitad de sesión. Usa Batch cuando corresponda; Fast apagado.

## Documentación obligatoria en cada cambio

- Cada implementación, modificación o corrección debe actualizar la documentación afectada en el mismo cambio, antes de considerarse terminada.
- Fuente de verdad de la guía de usuario: `docs/site/src/content/docs/`, publicada como HTML de Astro Starlight en `docs.habiteka.app` mediante el mismo despliegue de Habiteka.
- Si cambia comportamiento visible, herramientas, atajos, opciones, flujo, errores o límites, actualiza la página de usuario correspondiente y las novedades cuando cambie una función.
- Para cambios internos de infraestructura/configuración sin efecto visible, actualiza la documentación técnica pertinente en `docs/` y explica que el flujo de usuario sigue igual. Un reporte en `plans/` no sustituye la documentación.
- Documenta solo funciones reales. Marca las pendientes expresamente; no publiques datos, coordenadas, capturas privadas, credenciales ni detalles del proyecto de un usuario como ejemplos públicos.
- Revisa los atajos contra `src/canvas/editor-v2/editor-shortcuts.ts` y sus manejadores. No mantengas copias divergentes del manual.
- Verifica `npm run docs:updates` y `npm run docs:build`. Para un commit preparado usa `npm run docs:updates -- --staged`; para comparar con una base usa `--base <ref>`.
- La comprobación exige archivos documentados cuando hay código/configuración modificados; la revisión debe comprobar además que el contenido explica el cambio real.
- Referencia técnica y despliegue: `docs/documentacion-starlight.md`.
