# Revisión del plano importado y continuidad al Editor

Implementado el guardado de cotas, geometría de muros y ancho, posición, lado y bisagra de puertas. Muros y medidas permite superponer el original y seleccionar un elemento para abrir la revisión. El visor de revisión comparte zoom y desplazamiento entre imagen y geometría; ofrece opacidad, selección resaltada, propiedades y extremos de muro arrastrables.

Guardar revisión reconstruye desde la extracción persistida, conserva las correcciones manuales y devuelve una nueva revisión. No llama a la evaluación IA de pago. Mantiene los bloqueos previos y exige confirmación para aplicar al Editor. El guardado comprueba la revisión vista y realiza una escritura condicional por organización y revisión. La reconstrucción canónica, la puerta de calidad y el marco de referencia del Editor utilizan las mismas correcciones. El original sigue vinculado a la importación aplicada.

Se añaden deshacer/rehacer de geometría durante la sesión y aviso al volver con cambios pendientes. Los avisos con estancia resaltan esa zona; los generales muestran el ajuste de escala, sin inventar una ubicación concreta. Añadir o eliminar estructura sigue perteneciendo al Editor.

## Verificación

- 24 pruebas dirigidas pasadas: reconstrucción de correcciones, límites de huecos y muros, persistencia, conflicto de revisión, confirmación y envío real al Editor en PostgreSQL aislado y marcado.
- TypeScript sin errores y ESLint sin incidencias en los archivos afectados.
- `npm run docs:updates` y `npm run docs:build` correctos; guía y novedades actualizadas.
- CUA en una muestra sintética temporal: seleccionar puerta y muro, cambiar ancho a 1,10 m, rechazar 9 m, deshacer, cambiar grosor y mostrar el aviso de salida. La muestra temporal se retiró. La persistencia se verificó con las pruebas de integración, no mediante un guardado simulado.
- Un primer intento de pruebas de persistencia apuntó al nombre genérico de una BD de pruebas inexistente; falló sin tocar datos y se repitió correctamente sobre la BD aislada marcada existente.
- No se modificó Test 5 ni se utilizaron sus imágenes como fixtures o documentación. Sin llamadas IA, commit, push o despliegue.

## Límites

El historial de geometría se reinicia al guardar; no persiste entre sesiones. El original es una referencia y no se modifica. Las correcciones manuales se conservan en milímetros; si se cambia la escala global después, hay que revisar de nuevo esas posiciones. Guardar no aprueba automáticamente la calidad y enviar sigue sustituyendo el documento del Editor tras confirmación.
