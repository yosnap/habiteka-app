# Estabilidad del ajuste a paredes

- El arrastre de Konva combinaba la posición de una huella girada con la rotación original. Ahora calcula el desplazamiento desde el punto de agarre inicial y conserva la orientación de la vista previa.
- La elección de pared usa el centro solicitado antes de aplicar imanes de rejilla/esquinas; estos ya no cambian la pared candidata como efecto secundario del giro.
- Margen de salida para conservar la pared actual ante oscilaciones pequeñas. Fuera del alcance se conserva el giro hasta acercarse a otra pared.
- Colocación desde catálogo mantiene memoria de orientación por objeto pendiente. Al soltar un objeto existente se utiliza la posición mostrada, sin una segunda elección de pared.
- No modifica el movimiento de construcción ni añade orientación automática a las vistas que no la tenían.

Validación: 64 pruebas en siete archivos, incluidas oscilaciones cerca del umbral, cambio deliberado de pared y repetición del mismo punto tras un giro. TypeScript, ESLint y guía de usuario verificados. Documentación compilada con 19 páginas. La comprobación del parpadeo se basa en regresiones de posición/orientación, no en una grabación de un gesto manual.

Sin commit ni despliegue.
