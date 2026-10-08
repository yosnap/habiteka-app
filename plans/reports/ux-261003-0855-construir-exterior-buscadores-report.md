# Construir, Exterior y buscador de Propiedades

Fecha: 3 de octubre de 2026. Rama: `feat/publicidad-vertical-cotas`.

## Petición y resultado

El usuario pidió imágenes realistas en Construir y en Añadir terreno/Añadir pavimento, separar los filtros de Exterior y corregir el buscador de Propiedades que parecía contener dos campos.

- Doce categorías de Construir y las dos acciones de superficies muestran miniaturas realistas genéricas. Se mantienen las etiquetas, acciones y estados anteriores. Importar plano conserva su icono.
- Exterior distribuye búsqueda y categoría en filas independientes, con 8 px entre etiqueta/control y 16 px entre filtros. Hay 20 px antes de las fichas y una única alineación horizontal con las tarjetas de superficies.
- Propiedades conserva un único borde y foco en el input de búsqueda, con lupa integrada. El selector y los resultados tienen su propio espacio.
- Amueblar y Construir comparten un componente pequeño para las imágenes de navegación, con icono/SVG de respaldo si falla la carga.

## Causas corregidas

Los filtros de Exterior usaban etiquetas sin un contenedor de disposición y podían aparecer seguidos en la misma línea. El padding del catálogo anidado añadía además una sangría diferente. El buscador de Propiedades tenía un borde externo y otro interno: el selector global de inputs del editor prevalecía sobre la regla que intentaba quitar el borde del campo. Ahora el contenedor solo posiciona la lupa y el input conserva el borde normal del editor.

## Imágenes y documentación

`public/images/catalog/construction-v1.webp`: atlas de 14 fotografías generadas, 948 × 1660 px y 230062 bytes. Generado con `image_gen` integrado y convertido de PNG a WebP con Sharp. No se usaron referencias de inmuebles del usuario. Las regiones CSS excluyen los separadores del atlas sin editar su contenido.

Prompts, orden, procedencia y límites en `docs/catalogo-visual.md`. Guía de herramientas y novedades actualizadas en `docs/site/src/content/docs/`.

Las miniaturas orientan la navegación. No son imágenes aceptadas de un inmueble ni fotografías exactas de los modelos disponibles. Las fichas individuales de pérgolas y otros objetos conservan su representación actual; las opciones pendientes de Formas siguen pendientes.

## Verificación

- TypeScript y ESLint de los componentes afectados: correctos.
- Cinco pruebas existentes de navegación de catálogo e índice/búsqueda: correctas. Ejecutadas sin conexión a BD, con URL local ficticia reservada para pruebas unitarias. El primer intento sin esa variable fue bloqueado por la protección de BD antes de ejecutar pruebas.
- `npm run docs:updates` y `npm run docs:build`: correctos, 17 páginas y cero diagnósticos de Astro.
- Next.js, webpack y TypeScript: build de producción correcto en copia temporal aislada. El primer intento omitió los documentos legales que necesita el prerender; al incorporarlos a la copia terminó correctamente. Avisos OAuth locales preexistentes, sin relación con el cambio.
- CUA sobre `/dev/editor-v2?muestra=visual`: fotos de las doce categorías (incluidas rampas/escaleras al desplazar), tarjetas terreno/pavimento, filtros en filas y separación respecto a la primera pérgola.
- Filtro `piscina` combinado con Cerramientos sin resultados y Agua y drenaje con Piscina elevada: correcto.
- Propiedades: un borde, resultados separados y Enter sobre `armario` selecciona y centra el armario conservando el panel.
- Amueblar: miniaturas de Habitaciones y Categorías conservadas tras compartir el componente.
- Archivos de código modificados menores de 1000 líneas y `git diff --check` correcto.

Revisión visual de escritorio; no sustituye una prueba táctil en móvil real. No se modificó un proyecto real ni se aceptaron o generaron diseños/vídeos de inmuebles. Sin commit, push ni despliegue en esta ronda; se conservan los cambios anteriores de superficies y Medir. El material privado sin seguimiento en `plans/reports/` sigue excluido de cualquier preparación de commit.
