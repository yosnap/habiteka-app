# Fila contextual y límites del arrastre

## Cambios

- La fila secundaria solo aparece con herramienta activa, solo lectura o controles de referencia 2D. Texto se crea desde Herramientas y abre el inspector; Propiedades conserva Escena, selección y doble clic.
- Amueblado y Modelo 3D comparten movimiento individual limitado por barrido continuo de sólidos, seguido de la validación espacial canónica. El destino no puede saltarse una pared entre eventos del puntero.
- Los obstáculos y las colisiones previas se preparan una vez por gesto. Las excepciones de altura, soportes y colocación existente se conservan; los hijos apoyados participan en el cálculo.
- Durante el arrastre se desactiva la órbita. En plantas separadas se usa la elevación visual de la planta activa. Las capturas y recorridos no habilitan este arrastre.
- Duplicar con Alt/Option conserva su validación final. No cambia la construcción 2D ni las condiciones de resultados finales basados en diseños aceptados.

## Validación

- 40 pruebas pasan en los cuatro archivos de arrastre, colocación espacial e interacción visual. Incluyen pared, objeto, altura libre, repetición de eventos, retirada y guardado de la misma posición que la vista previa.
- TypeScript y ESLint sin errores; documentación comprobada y compilada (19 páginas).
- Navegador en muestra local: fila secundaria ausente en reposo y Añadir texto abre Propiedades con el texto editable. No se modificó un proyecto del usuario.
- La interacción física de arrastre en navegador no forma parte de esta comprobación; el trayecto y su integración con el almacén se verifican mediante las pruebas indicadas.
