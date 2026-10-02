# Constructor visual — 2 de octubre de 2026

## Alcance

Implementación de navegación y presentación inspirada en la organización observada en Planner 5D: catálogo por habitaciones/categorías, herramientas visibles e iconografía con color. Ilustraciones SVG propias; no se incorporan recursos ni datos del proyecto de referencia.

- Cabecera del proyecto compacta y pestañas con iconos.
- Editor: Construir, Amueblar, Exterior, Medir y Ajuste; preparación secundaria dentro de Herramientas.
- Catálogo por habitación/tipo, búsqueda y variantes reales. Cobertura completa de los elementos amueblables, incluidos accesorios exteriores.
- Catálogo persistente al interactuar con el lienzo. Escape y X permiten cerrarlo.
- Entrada visual del asistente y del estudio de planos. Nombres de vistas y etapas simplificados.
- Cursor de mano compartido en botones, enlaces, tarjetas interactivas y opciones de desplegables. Estados deshabilitados diferenciados.
- Vídeos conserva la página propia implementada en la ronda anterior y el requisito de diseños IA aceptados.

## Verificación

- 23 pruebas en 5 archivos: catálogo, búsqueda, paneles, atajos y preferencias; correctas. Ejecución con la BD local aislada de pruebas.
- TypeScript y ESLint: correctos.
- `npm run docs:updates` y `npm run docs:build`: correctos, 17 páginas.
- Compilación de Next.js en un checkout de verificación aislado: correcta.
- Navegador local: catálogo por habitaciones/categorías, búsqueda de lavabo, regreso, Exterior, Herramientas, apertura de Tejado y selector, Asistente, Plano existente y acceso a Vídeos.
- Revisión con ventana estrecha y tres incrementos de zoom: reflujo del plano y editor, menú Vista dentro de Herramientas. Restaurados zoom y ventana al terminar.
- `git diff --check`: correcto. Los archivos modificados de código mantienen menos de 1000 líneas.

## Límites

- No se ha realizado una prueba en un dispositivo móvil físico ni una prueba táctil.
- La comprobación visual de Plano se hizo con una fuente existente; las nuevas tarjetas de entrada se revisaron en código y compilación, sin reiniciar el plano del usuario.
- No se han generado ni aceptado imágenes/vídeos durante esta ronda. El cambio no acredita fidelidad audiovisual.
- Cambios locales, sin commit, merge ni despliegue de esta ronda.

## Documentación

Actualizadas herramientas, primer proyecto, importar plano, guardado/aprobación, parcela, tejado y novedades. Las páginas de vídeo conservan la explicación de la navegación independiente y los límites de funciones pendientes.

## Referencia

- [Navegación de Planner 5D](https://support.planner5d.com/en/articles/5876772-how-to-navigate-through-planner-5d).
- [Catálogo de Planner 5D](https://support.planner5d.com/en/articles/5876855-catalogue-menu-web).

## Preguntas pendientes

Ninguna que bloquee esta implementación. Queda la valoración visual del usuario sobre esta primera adaptación.
