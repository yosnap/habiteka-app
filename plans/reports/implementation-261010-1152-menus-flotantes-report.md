# Corrección de jerarquía y menús flotantes

El usuario rechazó el exceso de accesos sueltos y la apariencia de barra lateral de los paneles. No solicita arrastre. Aclara que el lateral del Plano 2D también puede cambiar; deben conservarse el método de construcción y sus herramientas.

## Implementación

- Siete grupos desplegables en los tres modos: Construir, Amueblar, Acabados, Visualizar, Asistente, Escena y Herramientas. Ayuda/Ajustes siguen abajo. Las tareas se centran cuando hay espacio y se desplazan cuando falta altura.
- Exterior dentro de Construir, Recorrido dentro de Herramientas, Propiedades dentro de Escena y en sus entradas contextuales actuales. Todas las categorías/campos originales siguen disponibles.
- Barra flotante superior: selector desplegable de vista, Seleccionar, Medir y Ajuste. Iluminación en un desplegable independiente; mismo estado y bloqueo durante grabación. Cámara centrada abajo, sin mover la escena al abrir menús.
- Paneles con altura de contenido y desplazamiento interno limitado al viewport. Sin arrastre. El asistente conserva su montaje diferido y paso local.
- Visualizar despliega entradas existentes de diseño editable, imágenes y estudio de vídeos. Abrir opciones no genera ni acepta resultados; se conservan las guardas de coste y guardado.
- CanvasView, comandos de construcción, geometría, atajos, cotas, recuperación y aceptación no cambian. El CSS original del editor se mantiene; la composición se aplica por marcadores del workspace.
- Guía Starlight, novedades, referencia, sistema de diseño, flujos, roadmap y plan actualizados con la aclaración final.
- Petición posterior: Escena incorpora pestañas Estructura/Mobiliario/Estancias, relación pared→puertas/ventanas, acordeones y Mostrar más. Renombrar usa los campos existentes. Ocultar es estado visual de sesión, aplicado a Konva y Three, sin editar geometría; se restaura antes de capturas/recorridos. Terminar dibujo/colocación es requisito previo. Las piezas internas conservan Propiedades del elemento principal.

## Verificación

- 46 pruebas correctas en siete archivos: árbol de escena, relación de huecos, suelos/techos/luces, nombres, visibilidad sin revisión geométrica, restauración de mallas, navegación, paneles, selección, atajos, reinicio de muestra e índice de elementos. La máscara 3D usa capas de dibujo para preservar cambios simultáneos de techo, muros o recortes.
- TypeScript y ESLint correctos. Compilación final y documentación comprobadas antes de cerrar la entrega.
- Navegación de los tres modos a 360/768/1440 px: los siete paneles dentro del viewport, cámara libre, barras superiores sin solapamiento y sin desbordamiento horizontal. 390 px comprobado en el pase inicial. Desplazamiento interno real confirmado.
- Muestra aislada: pared→ventana, cambio de nombre y Deshacer, ocultar/mostrar sin activar Deshacer. Visibilidad 3D final comprobada sobre píxeles del lienzo (136.550 píxeles cambiados en una región de 270.000), excluyendo el panel. Todos los elementos restaurados después.
- Construir→Tejado exterior abre un único diálogo también en 2D, sin crear cubierta ni editar geometría. Campos y controles originales presentes.
- Comet: referencia autenticada revisada y panel Escena de Habiteka abierto sobre el proyecto existente. No se cambia geometría ni nombres privados, no se aceptan diseños y no se genera material. Capturas temporales fuera del repositorio.
- HMR retenía el store anterior al añadir estado visual; recarga local y comprobación con carga estable sin errores de consola. No se modifica la infraestructura de producción.
- `npm run docs:updates`, `docs:build` (18 páginas, cero errores/avisos), compilación Next y `git diff --check` finales correctos. Documentación y aplicación se compilaron secuencialmente para evitar una carrera al copiar Pagefind a la salida standalone. Archivos afectados menores de 1000 líneas; Shell 965 y SceneView 904.

## Límites

Entrega local; sin commit ni despliegue. La emulación de viewport no sustituye hardware móvil real. Audio futuro. Se conserva el archivo ajeno `scripts/tmp-promo-fotos.ts`.
