# UX del constructor: Diseños y generación

## Alcance

Continuación tras el commit `c11fcf6` y el «ok» del usuario. Cambios locales en la galería compartida por Diseños y el generador. No se han generado medios, aceptado imágenes ni consumido IA. No hay un nuevo commit ni despliegue.

## Cambios

- Miniaturas con Pendiente de revisar, Aceptado, Descartado o Solo referencia. Cada bloque resume sus estados y muestra la revisión del plano registrada.
- Los nombres distinguen Solo la casa, Toda la planta, interiores, exteriores y selección de zonas/estancias. Los registros antiguos sin opciones indican Ámbito sin registrar; no se inventa cobertura.
- Visor extraído a un componente y CSS propios: imagen y panel de revisión/acciones en paralelo en escritorio; desplazamiento vertical en pantallas de hasta 900 px. Navegación bajo la imagen y cierre con área de interacción amplia.
- Aceptación explícita con fecha/hora UTC. La respuesta guardada actualiza galería y visor, y una versión igual o posterior del servidor prevalece sobre la copia local. Un descarte prevalece visualmente sobre una aceptación histórica; se conserva la opción de retirarla.
- Escape cierra el visor sin cerrar el generador. Flechas izquierda/derecha recorren imágenes desde los botones, respetando formularios y campos de edición. Al cerrar se devuelve el foco a la miniatura que abrió el visor.
- Se conservan las acciones existentes: fondo del plano, descarga, cambios y variante. El servidor de aceptación, sus permisos, control de versión y trazabilidad no se modifican.
- Guía de imágenes y novedades actualizadas; acceso a completar una tanda corregido a Vídeos → Construcción → Zonas incluidas y más vistas.

## Verificación

- 42 pruebas en cuatro archivos: etiquetas y agrupación de tandas, estados de aceptación, ejecución de tandas y requisitos de primera persona. Solo pruebas en memoria; sin acceso ni reinicio de BD.
- TypeScript y ESLint de archivos afectados correctos. El generador tiene 946 líneas; los componentes extraídos son pequeños.
- `npm run docs:updates` y `npm run docs:build` correctos: 17 páginas, sin errores ni advertencias de Astro.
- La comprobación visual no se pudo completar: el conector del navegador falla al iniciar su app-server y el control nativo detectó cambios simultáneos en otra ventana. No se operó sobre esa página ni se aceptaron diseños como prueba.
- Compilación Next.js con webpack en copia temporal: correcta, incluidos tipos, 31 páginas y salida standalone. Se enlazaron las dependencias locales y solo en esa copia se ajustó `outputFileTracingRoot: '/'`; configuración original y servidor de desarrollo intactos. Avisos de credenciales OAuth locales ausentes, ajenos al cambio.

## Límites y siguiente paso

- Actualización de cierre: la ronda `ux-261003-0709-accesibilidad-consistencia-report.md` verifica foco y Escape en la previsualización anidada, desplegables del generador y campo de cambios del visor; añade reflujo a 390 × 740. Sus límites sustituyen los pendientes gráficos anteriores. Esta ronda se incorpora al commit conjunto autorizado.
- Actualización en la ronda de Vídeos: verificados con CUA el modal en escritorio, reflujo al 250 %, desplazamiento a las acciones, navegación con flechas desde el botón de cierre, apertura del formulario sin envío, flechas respetando el campo y cierre con foco en la miniatura original. Zoom restaurado al 100 %. Sigue pendiente Escape anidado dentro del generador y móvil real; no se aceptaron imágenes.
- La aceptación visual sigue correspondiendo al usuario. El estado Aceptado no garantiza compatibilidad entre referencias ni fidelidad audiovisual.
- No se añade revisión posterior manual de descartes, generación de interiores derivados, paseo continuo ni pieza combinada.
- Siguiente bloque del handoff: Vídeos de principio a fin; después consistencia y accesibilidad general, incluido móvil real.
- Las referencias privadas sin seguimiento en `plans/reports/` se conservan fuera del cambio.
