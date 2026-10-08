# Menú contextual y duplicación con Option

El menú radial del plano 2D se ocultaba con Propiedades abierto. Eliminada esa condición: seleccionar una pared conserva sus acciones junto al inspector.

Completada duplicación por Option/Alt al arrastrar: pared con vértices independientes y copia de sus huecos, objetos seleccionados arrastrables desde su cuerpo, terreno/pavimento desde superficie o control central y objetos/superficies en Amueblado. El modificador se recoge al comenzar el gesto; al soltar se conserva el original y se selecciona la copia. Las paredes de la vista Amueblado siguen sin admitir arrastre directo; se editan desde el plano 2D.

Validación: pruebas de copias de pared, huecos, objetos y superficie más interacción de escena; TypeScript y ESLint correctos. Documentación de usuario y novedades actualizadas, comprobación y compilación de docs correctas. CUA bloqueado en dos intentos por fallo de arranque del pipe nativo; no se afirma verificación visual del gesto en esta ronda. Sin cambios en documentos del usuario, commit ni despliegue.

Preguntas pendientes: ninguna. Pendiente de verificación visual cuando vuelva a estar disponible CUA.
