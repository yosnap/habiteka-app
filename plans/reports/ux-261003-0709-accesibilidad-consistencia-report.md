# UX del constructor: consistencia y accesibilidad

## Alcance

Continuación autorizada con «ok, adelante y hacemos el commit luego». Cierra esta ronda de teclado, ventanas y reflujo, e integra las rondas locales de Diseños/generación y flujo de Vídeos en un commit conjunto. Sin push ni despliegue.

## Cambios

- El generador y su vista ampliada usaban contenedores sin gestión de foco. Se extrae un marco Radix Dialog: foco inicial en el cierre, Tab/Mayús+Tab contenidos, restauración al control de origen y Escape reservado al nivel activo.
- La vista ampliada incorpora cierre explícito de 44 × 44 px; el estudio mantiene el cierre bloqueado durante preparación/generación. Cabecera y pie permanecen accesibles, con desplazamiento del contenido y altura dinámica del viewport.
- Los desplegables siguen funcionando dentro del diálogo. No se cambian generación, precios, permisos, aprobación ni aceptación.
- Vídeos usa pestañas Radix con selección anunciada, panel asociado, flechas de teclado y foco visible. Los accesos a guardados/publicidad enfocan la pestaña de destino. Se mantiene el desmontaje al cambiar de pestaña y el aviso sobre ajustes locales sin guardar.
- El selector de material de publicidad anuncia su estado activo; Guía anuncia que abre otra pestaña. Se actualizan las guías de imágenes, estudio y novedades.
- El generador queda en 888 líneas tras extraer el marco; todos los archivos de código afectados permanecen por debajo de 1000.

## Verificación

- 65 pruebas en nueve archivos: galería/ámbitos, aceptación y versiones, requisitos de construcción/visita, ejecución de tandas, atajos y controles UI permitidos. Solo pruebas en memoria, sin conexión ni reinicio de BD.
- TypeScript y ESLint de todos los archivos TS/TSX modificados o añadidos: correctos.
- `npm run docs:updates` y `npm run docs:build`: correctos, 17 páginas, sin errores ni advertencias de Astro. La comprobación de documentación preparada se ejecuta antes del commit.
- Next.js con webpack en copia temporal: compilación, tipos, 31 páginas y standalone correctos. Dependencias locales enlazadas; `outputFileTracingRoot` ajustado solo en la copia. Avisos conocidos de OAuth local sin credenciales.
- CUA nativo en Chrome: apertura del estudio con foco en Cerrar; Mayús+Tab al último control y Tab al primero; ampliación de la previsualización local, foco contenido y Escape devuelve al botón de ampliación sin cerrar el estudio. Escape en Tipo de espacio cierra el desplegable; cierre del estudio devuelve el foco a Diseñar con IA.
- Reflujo con DevTools a 390 × 740: estudio, vista ampliada y Vídeos legibles, con cierre y acciones accesibles. Flechas derecha/izquierda cambian Crear vídeo/Vídeos guardados y mantienen el foco en la pestaña activa. Emulación desactivada y DevTools cerrado al terminar.
- Galería real existente: Pedir cambios abre su formulario; Escape desde el campo de texto cierra la imagen y devuelve el foco a la miniatura. No se escribe ni envía una petición.
- No se aceptan imágenes, aprueban versiones, generan medios, limpian resultados ni ejecutan operaciones de pago. No se guardan capturas o datos privados en el repositorio.

## Límites

- La emulación de viewport no sustituye un móvil táctil real ni una prueba con lector de pantalla.
- El anidamiento gráfico se prueba con la previsualización local del generador y sus desplegables. La galería posterior a una generación dentro de ese mismo modal se revisa en código; no se inicia una generación para probarla.
- Los accesos posteriores a una aceptación/guardado y el flujo audiovisual completo conservan los límites del informe de Vídeos: requieren referencias aceptadas y decisión del usuario. No se declara fidelidad audiovisual por estas verificaciones.
- La valoración visual del usuario, el paseo continuo y la pieza combinada siguen pendientes. Las referencias privadas sin seguimiento quedan fuera del commit.
