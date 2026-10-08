# Restablecimiento completo de la muestra local

Fecha: 3 de octubre de 2026. Rama: `feat/publicidad-vertical-cotas`. Sin commit, push ni despliegue.

## Petición y diagnóstico

El usuario indica que pulsar Restablecer muestra no tiene efecto, desde Modelo 3D. La primera comprobación solo acreditaba que un elemento eliminado volvía al documento; no bastaba para verificar el reinicio completo ni la experiencia del usuario.

El manejador anterior sustituía únicamente documento, historial, selección y herramienta. Dejaba cámara, paneles, iluminación local, gestos y otros estados de sesión, sin ninguna confirmación visible. Además, insertaba la muestra sin la normalización que se aplica al abrir el editor. No se reprodujo una ausencia total de actualización del documento en la copia aislada; sí se comprobó que el restablecimiento de la sesión era incompleto.

## Corrección

- `reset-preview-sample.ts` crea una instancia nueva usando el mismo constructor y normalización que la carga inicial. Conserva el documento e historial previos para deshacer; elimina los estados transitorios y el futuro descartado.
- `preview-client.tsx` cambia la instancia y remonta EditorShell. Reinicia la cámara y el estado local de sus componentes, vuelve a Plano 2D encuadrado y cierra paneles.
- Confirmación visible y accesible Muestra restablecida, también en clics repetidos. Si falla la preparación de la muestra, informa del error conservando la copia actual.
- La persistencia se vuelve a suscribir a la instancia nueva. Se mantiene la protección de copias ilegibles; no se borran ni se sobrescriben automáticamente.
- Preferencias generales de visibilidad y atajos conservadas. Ningún cambio en el editor o guardado de proyectos reales.

## Verificación

- Dos pruebas de regresión: restauración normalizada, deshacer/rehacer, cancelación de colocación y sesión, acciones que pertenecen a la nueva instancia y conservación de la copia previa. Correctas, sin BD.
- TypeScript y ESLint de los archivos afectados: correctos.
- `npm run docs:updates`, `npm run docs:build`: correctos, 17 páginas y cero diagnósticos de Astro.
- Build de Next.js/webpack/TypeScript: correcto en copia temporal aislada, sin alterar `.next` del servidor de desarrollo. Avisos OAuth locales preexistentes.
- CUA, muestra independiente: eliminar armario, abrir Modelo 3D, acercar y activar Noche ambiental; restablecer recupera el armario, vuelve a Plano 2D encuadrado, cierra Propiedades y muestra confirmación.
- Deshacer quita de nuevo el armario; Rehacer lo recupera. Al abrir Modelo 3D vuelve Isométrica/Luz de día. Un segundo clic también vuelve a Plano 2D.
- Tras recargar, la muestra recuperada conserva el armario, comprobado en el buscador. El historial solo vive en la sesión de edición.
- Código y assets de la copia compilada comparados con el workspace; copia temporal eliminada. `git diff --check` correcto.

Guía de herramientas, novedades y documentación de arquitectura actualizadas. Material privado y cambios anteriores conservados sin preparar un commit.

## Pendiente

Valoración del usuario en la pestaña donde notificó el fallo. No se ha reproducido un fallo total del clic en la copia de prueba, por lo que no se atribuye a una causa de navegador no demostrada.
