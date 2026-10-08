---
title: Guardar y aprobar
description: Diferencias entre borrador, sincronización y diseño aprobado.
---

## Borrador y sincronización

El editor conserva y sincroniza tus cambios. El estado **Sincronizado** indica que no quedan cambios pendientes en su cola de guardado. Si aparece un error o conflicto, resuélvelo antes de generar o aprobar.

**Guardar cambios** dentro de Parcela real aplica el encaje al borrador. Después comprueba la sincronización del editor: aplicar un ajuste al borrador no equivale a aprobarlo.

## Aprobar una versión

1. Revisa el plano, objetos, plantas, techos y parcela.
2. Espera a **Sincronizado**.
3. Abre **Herramientas** y pulsa **Aprobar diseño** si es la primera vez, o **Aprobar cambios** si ya hay una versión. Desde Parcela real, tras confirmar el encaje, puedes usar **Revisar y aprobar diseño**.
4. En la ventana de revisión, comprueba la luz y pulsa **Confirmar aprobación**. La entrada desde Parcela real propone la luz de esa parcela.
5. Sigues en el editor. **Herramientas → Ver aprobado** abre la copia conservada después de la primera aprobación; **Volver al editor** regresa al borrador. Para presentar los renders, abre **Vídeos**.

Esta aprobación fija la geometría y las medidas del plano guía; no acepta por sí sola las imágenes IA. Abre cada render en **Diseños** y pulsa **Aceptar este diseño** después de revisarlo. Vídeos y visitas finales deben partir de esas imágenes aceptadas y conservar sus muebles y acabados. Aprobar no genera imágenes ni vídeos. Editar el borrador no modifica los resultados anteriores; cambiar geometría, encaje o luz puede requerir nuevas imágenes coherentes y su aceptación.

## Aviso al cambiar un diseño aprobado

En cuanto un cambio aparta el plano de la versión aprobada aparece el aviso **El plano ya no coincide con el diseño aprobado**. Basta mover un mueble 1 cm con las flechas. Las rutas, los comentarios y los rótulos movidos dentro de su estancia no cuentan. Mientras no coincida, las imágenes aceptadas con esa versión no sirven para generar nuevos interiores ni vídeos.

- **Deshacer** recupera el estado anterior. Solo aparece si hay historial en esta sesión; después de recargar, deshaz el cambio a mano.
- **Aprobar cambios** abre la revisión de la nueva versión. Después tendrás que generar y aceptar imágenes coherentes con ella.
- **Mantener el cambio** oculta el aviso hasta el siguiente cambio.

## Si aparecen dos versiones

El aviso **Otra pestaña guardó la revisión…** indica que el servidor tiene otra edición y se ha pausado el guardado para evitar sobrescribirla.

1. **Descargar copia de ambas versiones** conserva un respaldo.
2. **Conservar mi edición** guarda la edición de esta pestaña como nueva revisión activa.
3. **Usar la versión guardada** carga la del servidor y respalda la edición local en el dispositivo.
4. Revisa la explicación y pulsa **Confirmar elección**.

Cerrar el aviso solo lo oculta; no reanuda el guardado. Evita editar el mismo proyecto simultáneamente en varias pestañas.
