# Versiones recuperables de proyectos

**Estado:** historial y recuperación del plano implementados; versión integral del proyecto pendiente.

## Objetivo

Permitir que una persona consulte las versiones guardadas de un proyecto, vea qué cambiaría y recupere una versión anterior sin perder la actual.

## Punto de partida

- El editor conserva revisiones inmutables en `EditorDocumentRevision`. «FInca» recuperó la 75 como revisión 81. Las aprobaciones posteriores se conservan y el usuario ha seguido editando el proyecto.
- «Historial» tiene una pestaña «Versiones del plano» con listado paginado, vista previa cenital/3D, enlace a cada diseño aprobado y recuperación explícita. Recuperar copia la revisión elegida como nueva revisión con control de concurrencia; la anterior permanece disponible. El editor ya no muestra una barra fija de versiones.
- El estado del estudio, las imágenes de origen y los entregables no forman hoy una versión recuperable única del proyecto.
- Puede existir un borrador local en IndexedDB que no se haya sincronizado. Su recuperación requiere un tratamiento separado. El aviso de borrador ilegible ya se puede ocultar sin borrar el registro.

## Trabajo pendiente

1. Definir qué integra una versión del proyecto y cómo se relacionan proyecto, zona, plano, estudio, imágenes y entregables. Guardar referencias estables a los recursos, con control de acceso por organización.
2. Ampliar el historial del plano con autor, nombre opcional y un resumen comparativo de cambios; fecha, zona y vista previa ya están disponibles.
3. La recuperación del plano mediante **nueva revisión**, con control de concurrencia y permiso de organización, ya está implementada. Extenderla cuando exista una versión integral del proyecto.
4. Mantener la trazabilidad de los diseños aprobados, visitas y vídeos: una recuperación no debe reescribir aprobaciones ni asociar entregables a un estado distinto sin indicarlo.
5. La recuperación del plano se detiene si este navegador tiene borradores locales pendientes o dañados en el mismo ámbito. Sigue pendiente ofrecer exportación o recuperación especial de un borrador dañado.
6. El repositorio del plano tiene pruebas aisladas de listado, permisos entre organizaciones, recuperación y conflicto de guardado. Faltan pruebas de recursos ausentes y del proyecto integral.

## Criterio de aceptación

Para el **plano**, se puede elegir y previsualizar una versión anterior desde «Historial», recuperarla sin borrar la actual y recuperarla de nuevo más adelante. El criterio de versión integral sigue pendiente para estudio, imágenes y entregables.
