# Instrucciones del repositorio

- Habla siempre en español.
- Los archivos no deben superar 1000 líneas salvo necesidad importante. Fragmenta componentes y scripts manteniendo buenas prácticas. Los lockfiles generados son una excepción.
- Edita con parches/diffs; no reescribas archivos completos.
- Para una tarea especificada, usa un agente. Fan-out máximo 3 solo en tareas ambiguas y cuando la sesión permita delegación.
- No superes 200.000 tokens de contexto; resume antes. No cruces 272K.
- No cambies el prompt de sistema ni el orden de herramientas a mitad de sesión. Usa Batch cuando corresponda; Fast apagado.

## Regla principal de producto: diseños IA aceptados

- Imágenes finales, vídeos de construcción/publicidad/primera persona, inmersión y visita virtual deben representar los renders de diseño generados con IA y aceptados explícitamente por el usuario. Una auditoría automática no sustituye su aceptación.
- El plano y su 3D son exclusivamente guías de geometría, distribución, medidas y preparación. No ofrecer sus capturas, recorridos ni grabaciones como el resultado final, ni utilizarlos como sustituto cuando faltan diseños aceptados.
- Mobiliario, acabados y apariencia proceden del diseño aceptado, aunque difieran del plano guía. Conservar arquitectura e identidad completa: no inventar accesos ni perder tabiques, tejados, pérgolas o elementos seleccionados.
- Exigir resultado hiperrealista y fidelidad temporal revisada contra las referencias aceptadas. No dar por cumplido este requisito con un prompt, auditoría automática, compilación o vídeo conceptual.
- Si falta una referencia aceptada o una modalidad todavía no está implementada sobre diseños, indicarlo y bloquear su creación; nunca volver al 3D como alternativa automática o manual dentro de este flujo.
- Las referencias visuales existentes en la documentación orientan el acabado y la animación; no sustituyen las imágenes aceptadas de cada inmueble. No aceptar imágenes ni iniciar gasto en nombre del usuario sin autorización específica.

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
