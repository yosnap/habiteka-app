# Guías magnéticas, movimiento y valores

## Cambios

- Referencias comunes de extremos, centros, caras físicas y ejes: paredes, objetos espaciales, habitaciones/patios, aberturas, luces, etiquetas, medidas y puntos de recorrido.
- Guías verdes durante arrastre/dibujo; interruptor Ajuste controla el imán. Alcance de ejes 10 px independiente del zoom; esquinas de dibujo y conexiones estructurales mantienen prioridades propias.
- Contacto físico de objeto-pared al final del ajuste: no devolver origen al eje ni separar por referencia posterior. Columnas/rampas/descansillos conservan vínculo estructural.
- Resolver de puertas/ventanas alinea centro/extremos a referencias proyectadas sobre muro, sin perder anfitrión ni agarre. Misma posición en preview y commit.
- Movimiento con flechas ampliado a paredes, habitaciones, patios, etiquetas, medidas, puertas/ventanas, techos ligados a recinto y waypoints, además de objetos/luces. Paso 10 mm; Mayús 100 mm; sin redondeo magnético. Vértices deduplicados y validación geométrica/collision existente.
- Campo DecimalStepper compartido: coma/punto, flechas, botones al foco/hover, mantiene foco entre incrementos. Sustituye remount anterior key=value.
- Superficies de habitación también arrastrables, además de patios. Movimiento de mobiliario sigue independiente de la superficie.

## Verificación

- Suite final: 770 pruebas pasan, 3 omitidas; 96 archivos pasan y 2 omitidos.

- Nuevos tests de centros, umbral según zoom, anfitrión de ventana, nudge paredes compartidas, textos/cotas/aberturas y patio con etiqueta/acabado.
- Tests previos de origen sobre eje actualizados al contacto físico: 75 mm de semigrosor sin penetración.
- Navegador con componentes reales: cinco herramientas siguen lápiz/arrastre/selección; patio menú/arrastre/texturas; input conserva foco tras ArrowUp repetida y botón reduce; guía aparece durante arrastre y texto termina exactamente en eje de referencia.
- TypeScript, ESLint enfocado y build de producción pasan. Build avisa de credenciales OAuth locales ausentes.
- Referencias de recintos opcionales en borradores incompletos; imán no bloquea dibujo por una topología provisional. Validación completa continúa en commit.

## Reglas conservadas

- Puertas/ventanas se mueven a lo largo del muro, no flotan fuera.
- Perímetro importado protegido y vértices compartidos del patio siguen fijos según decisión del usuario.
- Imán no autoriza penetraciones ni conexiones inválidas.
- No commits, despliegue ni generación IA de pago.

## Preguntas abiertas

Ninguna bloqueante.
