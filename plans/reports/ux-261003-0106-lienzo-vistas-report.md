# UX del constructor: lienzo y vistas

## Alcance

Continuación autorizada con «adelante» tras propiedades y selección. Se conserva el trabajo local anterior en `feat/publicidad-vertical-cotas`. Sin commit, despliegue, aceptación de diseños ni generación de medios.

## Cambios

- Los paneles reservan una columna junto al lienzo; por debajo de 800 px pasan a una fila inferior con desplazamiento propio. Los controles de cámara y el recorrido quedan dentro del espacio disponible.
- Plano 2D conserva centro y escala al redimensionarse o abrir/cerrar paneles. Las peticiones de búsqueda se consumen únicamente en la vista activa.
- El selector de vistas conserva selección, panel y sección de propiedades. Entrar de nuevo en Modelo 3D no cambia el techo si ya era la vista activa. Los presets de cámara tampoco deseleccionan.
- Amueblado incorpora Alejar, Acercar, Encuadrar y Mano. Mano desplaza la cámara sin arrastrar muebles ni colocar el objeto pendiente. En Plano 2D deja de cancelar el trazo.
- Cambiar entre Plano 2D y Amueblado conserva el objeto pendiente. Modelo 3D se deshabilita durante su colocación. Cancelar colocación y Escape permiten descartarlo conservando el catálogo y sin crear una entrada de historial.
- Las herramientas de trazado llevan al plano técnico; pegar/añadir desde Modelo 3D lleva a Amueblado. Esta decisión está centralizada en `view-mode.ts`.
- Editar propiedades deja de reiniciar la cámara 3D. Buscar un elemento centra también Amueblado/Modelo 3D; encuadre y zoom de teclado actúan sobre la vista activa, salvo durante reproducción/captura.
- Escape respeta campos y diálogos y sigue disponible para salir de una operación aunque estén desactivados los atajos.

## Verificación

- 71 pruebas distintas en 7 archivos: navegación (14), encuadre de cámara, panel lateral, propiedades, atajos, colocación y selección/drop. Solo pruebas en memoria, sin reinicio ni escritura de BD. El fixture nuevo necesitó completar los campos espaciales obligatorios; pasó tras corregirlo.
- TypeScript y ESLint de los archivos modificados: correctos. `git diff --check`: correcto.
- `npm run docs:updates` y `npm run docs:build`: correctos, 17 páginas. Guías de herramientas y atajos, además de novedades, actualizadas.
- Compilación final Next.js con webpack en copia temporal: correcta, incluidos tipos, 31 páginas y salida standalone, con la última corrección de cambio de herramienta.
- Navegador con CUA sobre `/dev/editor-v2?muestra=visual`, independiente de proyectos: panel junto al lienzo; pared seleccionada y Acabados conservados al entrar en 3D; zoom de cámara conservado al cambiar altura de 2,7 a 2,8 m y deshacer; pegar desde 3D abre Amueblado; Mano desplaza la cámara sin insertar la copia; la misma copia pasa a 2D, se coloca y se deshace; Escape cancela otra copia y mantiene Amueblar.
- Trazo de pared sin confirmar: Mano desplaza el plano, permite retomarlo y Escape lo descarta sin añadir paredes. Vistas incompatibles deshabilitadas con motivo.
- Reflujo a 300 % y 400 %: panel inferior y controles accesibles con desplazamiento. Zoom restaurado al 100 %. No equivale a prueba móvil/táctil real.

## Límites y continuación

- El encuadre manual de Amueblado/Modelo 3D no se conserva al salir de esas vistas: se entra en cenital/isométrica. Está documentado; no se añadió caché de cámara.
- El cambio de planta o de plantas apiladas sigue solicitando encuadre; la cámara interior conserva su excepción previa.
- La corrección final de herramientas desde 3D se verificó con pruebas y compilación; no se repitió esa última interacción gráfica.
- No se publicaron capturas ni datos privados. Las modificaciones de documento usadas en la muestra se deshicieron.
- Continúa pendiente la valoración visual del usuario y la revisión en móvil real. Siguiente fase: Diseños y generación, seguida de Vídeos y accesibilidad general.

## Ejecución de build

Se copió el estado local a una carpeta temporal, con cliente Prisma generado y dependencias locales enlazadas. Solo en esa copia se ajustó `outputFileTracingRoot: '/'` para que standalone resolviera el enlace de dependencias situado en otro volumen. La configuración del repositorio no se modificó. Los avisos de OAuth por credenciales locales ausentes son ajenos al cambio.
