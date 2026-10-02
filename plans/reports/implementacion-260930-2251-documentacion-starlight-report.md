# Documentación dedicada integrada en Habiteka

## Resultado

- Astro 7.3.5 / Starlight 0.42.4 en `docs/site/`: compilador aislado dentro del mismo repositorio.
- Un solo despliegue/servidor de producción. HTML generado incorporado a `public/documentacion/`; Next sirve `docs.habiteka.app` mediante routing por host. Sin aplicación Astro en runtime ni proyecto separado de Workers/Pages.
- Docker compila la documentación en una etapa Node y la incluye en la misma imagen de Habiteka. CI instala su compilador y el build raíz genera documentación y aplicación.
- 15 páginas de guía más 404: proyecto, importación, guardado/aprobación, herramientas, atajos, techos/tejado, parcela, imágenes, tipos de vídeo, montaje, recorrido, promoción, problemas y novedades.
- Español, búsqueda Pagefind, navegación por temas, índice por página y tema claro/oscuro.
- Ayuda de la aplicación enlaza al manual. La guía previa queda identificada como instantánea inicial, para mantener una fuente pública vigente.
- Regla obligatoria en `AGENTS.md` y estándares: actualizar documentación con cada cambio. Gate local/staged/base y en CI. Revisión semántica sigue siendo necesaria: el gate comprueba presencia, no pertinencia del contenido.

## Verificación local

- `npm run build`: Starlight y Next completados, sin errores de tipos. Starlight: 16 HTML, índice de búsqueda y sitemap.
- ESLint de scripts, routing, Ayuda y pruebas: correcto.
- Gate `npm run docs:updates`: correcto.
- 4 pruebas aisladas del gate: rechaza producto sin guía, exige documentación técnica y distingue cambios solo de documentación.
- HTTP local: portada y atajos devuelven 200 con host de documentación. Chrome en `http://docs.localhost:3040`: portada, navegación y búsqueda «tejado», 7 resultados, apertura de la guía correcta; estilo verificado.
- Salida de producción servida temporalmente en 3042: portada y atajos con host `docs.habiteka.app` devuelven 200; `/acceder` en el host de aplicación sigue devolviendo 200. El servidor temporal se detuvo. La comprobación usa `next start`; Docker ejecutará el runner standalone descrito en su configuración.
- `git diff --check`: correcto.
- Avisos previos del entorno en el build Next: proveedores OAuth Google/Facebook sin credenciales locales. No afectan a la generación estática; no se modificó autenticación.
- No se construyó la imagen Docker completa ni se desplegó remotamente durante esta ejecución.

## Publicación pendiente

Añadir `docs.habiteka.app` al mismo servicio de Dokploy, apuntar su DNS al despliegue existente, publicar la rama revisada por su flujo habitual y comprobar HTTPS. Ningún recurso remoto se creó o modificó; no se ejecutó CI remota, commit ni push.

Instrucciones: [operación y mantenimiento](../../docs/documentacion-starlight.md). Fuente pública: `docs/site/src/content/docs/`.

## Preguntas pendientes

Ninguna sobre dominio o arquitectura: el usuario confirmó `docs.habiteka.app` y un solo repositorio/despliegue. Falta ejecutar la vinculación del subdominio y el despliegue existente.
