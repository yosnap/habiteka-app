# Referencia original después de guardar una revisión

Comprobado en la interfaz del proyecto indicado: faltaba Mostrar original aunque la importación conservaba su fuente. Lectura de estado confirmó una importación existente con imagen y `planImportApplied: false`.

Corregida la condición de carga de referencia del Editor del proyecto: una revisión guardada sin aplicar puede mostrar la imagen conservada sin sustituir el documento. La marca de aplicación sigue gobernando el flujo de importación, pero no la disponibilidad del fondo.

Verificación CUA tras recargar: original visible detrás del plano 2D, botón Ocultar original y opacidad al 75 %. Sin modificar o guardar el documento del usuario. No se publican capturas ni identificadores privados.

TypeScript, ESLint, `docs:updates` y `docs:build` correctos. Guía y novedades actualizadas. Sin commit ni despliegue. El ámbito de zona individual sigue sin cargar esta referencia de proyecto.

Preguntas pendientes: ninguna.
