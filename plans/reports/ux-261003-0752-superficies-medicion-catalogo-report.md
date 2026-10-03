# UX: superficies, medición y catálogo

Fecha: 3 de octubre de 2026. Rama: `feat/publicidad-vertical-cotas`.

## Petición

Corregir la falta de imanes y redimensionado de pavimento/terreno, revisar otros elementos, explicar Medir e incorporar miniaturas realistas a Habitaciones y Categorías. Las dos capturas adjuntas contenían texto de otro trabajo: se usaron la descripción del usuario y la interfaz local como referencia funcional.

## Cambios

- Geometría compartida de superficies: ocho tiradores, tamaño entre 50 y 200000 mm por lado, borde opuesto fijo y giro limitado a la textura. Mover/redimensionar usa los mismos imanes y referencias a cualquier zoom, con guías y exclusión de la propia superficie.
- Plano 2D: controles de terreno/pavimento, control central, movimiento de selección múltiple, flechas y selección por marco. Se mantienen accesibles los muebles y paredes situados sobre la superficie.
- Amueblado: controles específicos sobre la escena cenital, previsualización del material y geometría, captura del puntero y un solo cambio de historial al soltar. Escape, pérdida de captura, cancelación y pérdida de foco descartan el gesto pendiente. Se corrigió durante QA una previsualización que no confirmaba al soltar dentro del portal HTML de R3F.
- Añadir superficies abre Amueblado y Propiedades, selecciona el elemento y solicita encuadrar. El tamaño y posición también se editan numéricamente.
- Revisión de otros elementos: muebles, escaleras, rampas, pilares, vallas y cocinas ya compartían tiradores de Plano 2D; ahora sus esquinas usan ajuste magnético. Los huecos conservan sus controles vinculados a paredes y las terrazas su contorno. No se ha añadido una familia nueva de tiradores de muebles en Amueblado.
- Medir: gesto de arrastrar explicado en herramienta, cabecera y lienzo; cota y distancia durante el gesto, selección al terminar, distancia en Propiedades y cotas indexadas en el buscador. La cota seleccionada queda visible con el filtro Ocultas/Solo exteriores; las cotas manuales también se muestran mientras se usa Medir.
- Catálogo: nueve habitaciones y doce categorías con fotografías ilustrativas propias generadas con `image_gen`. Dos atlas WebP, 539764 bytes en total, carga diferida y respaldo SVG. Se mantienen nombres accesibles, fichas, filtros y variantes. No son fotos exactas de modelos ni diseños aceptados de inmuebles.

## Documentación y procedencia

- Guía de herramientas y novedades en `docs/site/src/content/docs/`.
- Assets, composición, orden y prompts exactos: `docs/catalogo-visual.md`.
- Atajos contrastados con `src/canvas/editor-v2/editor-shortcuts.ts` y los manejadores: M, A, flechas, Mayús+flechas y deshacer. Sin nuevos atajos.

## Verificación

- 39 pruebas correctas en nueve archivos: transformaciones de terrenos, superficies, imanes, marco de selección, redimensionado y apoyo, atajos, interacción cenital, índice de elementos y navegación de catálogo. Geometría en memoria, sin modificar BD.
- TypeScript y ESLint correctos para los archivos afectados.
- `npm run docs:updates`, `npm run docs:build` y `git diff --check` correctos.
- Next.js compilado con webpack y comprobación de tipos en una copia temporal aislada, sin alterar `.next` del servidor local. Avisos preexistentes de proveedores OAuth sin credenciales locales; build correcto.
- CUA en muestras independientes: pavimento de 4 × 3 m ampliado a 7 × 3 m con imán, movimiento central ajustado a referencias, flechas y deshacer. Amueblado conserva tamaño y posición al soltar y restaura el movimiento con deshacer.
- Terreno encuadrado con ocho tiradores en Amueblado, tamaño libre con Ajuste desactivado, selección de un mueble sobre el terreno y redimensionado magnético de ese mueble en Plano 2D.
- Medida de 10 m trazada y seleccionada con filtro Ocultas, visible en Propiedades y recuperable por búsqueda tras deseleccionar.
- Miniaturas de habitaciones y categorías comprobadas en navegador; categoría Camas filtra los cuatro elementos esperados y permite volver al inicio.

## Límites y estado

- Verificación visual de escritorio. Los gestos táctiles, lector de pantalla y valoración estética del usuario siguen pendientes; las pruebas geométricas no sustituyen esa revisión.
- No se modificaron proyectos reales, aceptaciones de diseños ni se generaron medios finales de inmuebles. Los únicos assets IA creados son las ilustraciones genéricas solicitadas para el catálogo.
- Cambios locales posteriores a `0533319`; sin nuevo commit, push ni despliegue en esta ronda. Los ficheros privados preexistentes de `plans/reports/` se conservan fuera del alcance.
