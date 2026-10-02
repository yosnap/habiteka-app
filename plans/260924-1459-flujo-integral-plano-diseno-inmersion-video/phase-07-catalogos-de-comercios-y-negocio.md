---
title: "Fase 7: Catálogos de comercios y negocio"
status: todo
---

# Fase 7: Catálogos de comercios y negocio

## Objetivo

Incorporar productos concretos de mueblerías y tiendas de electrodomésticos al mismo catálogo con el que se diseña y visita el inmueble, y probar un canal comercial transparente sin comprometer la fidelidad del 3D.

## Dependencias y alcance

La búsqueda y definición del socio piloto comienza en paralelo a las fases 1–3; la importación técnica requiere que la fase 3 haya unificado catálogo propio, Editor v2 y propuesta IA. El primer piloto requiere una mueblería que autorice el uso de sus datos e imágenes, especifique actualización de precio/stock y, para mostrar un SKU exacto en 3D, conceda un modelo 3D o licencia para producirlo. No iniciar contacto ni publicar material comercial sin mandato y acuerdo adecuados. Una foto de producto no se convierte automáticamente en un modelo 3D fiel. Inmobiliarias e interioristas se validan en paralelo sobre el núcleo común.

## Trabajo

1. Preparar el piloto comercial: criterios para elegir una mueblería, propuesta de valor, interlocutor, selección pequeña de productos y acuerdos de datos/licencia. Definir si la conversión inicial será cita, solicitud de presupuesto o carrito; no presumir una integración de venta que la tienda no pueda operar.
2. Definir ficha canónica por comercio + SKU + variante, con marca, nombre, categoría, medidas, fotos, atribución/licencia, URL comercial, moneda, precio/stock y fecha de comprobación. Separar versiones históricas de imagen/GLB de la ficha comercial viva. Aprovechar `CatalogItem`; migrar solo los campos/relaciones que falten.
3. Crear importación progresiva: alta manual para piloto pequeño; CSV/feed con mapeo, validación, deduplicación, baja y reconciliación; API/webhook solo si el comercio la ofrece. No realizar scraping como dependencia del negocio sin permiso y condiciones claras. Guardar errores por producto y permitir revisión antes de publicar.
4. Validar activos 3D: formato, licencia, orientación, escala, medidas y parecido con fotos oficiales. Si falta GLB, permitir solo aproximación claramente rotulada. Verificar que el mueble cabe y no bloquea puertas/rutas antes de que la IA lo proponga.
5. Integrar búsqueda/filtros por estancia, estilo, medida, marca, tienda y disponibilidad en el catálogo común. La IA decora con IDs elegibles, explica por qué seleccionó cada producto y deja cambios manuales; no puede fabricar SKU, precio ni disponibilidad.
6. Mostrar ficha y «Ver en tienda» desde el proyecto o inventario del diseño; comprobar enlace y datos actuales al abrir. La visita 3D puede mostrar información contextual sin interrumpir el paseo. El vídeo publicitario puede añadir tarjeta de producto solo cuando la toma sea fiel y el uso comercial esté autorizado.
7. Enlazar el marketplace/seguimiento de clics existente con la identidad canónica de producto. Definir con cada socio el modelo económico (afiliación, lead, catálogo patrocinado u otro), atribución, vigencia, transparencia de contenido patrocinado y métricas. No presentar la semilla actual como inventario de socios reales.
8. Piloto de extremo a extremo con una tienda y una selección pequeña: importar, revisar, colocar en diseño, aprobar, visitar, generar vídeo, abrir ficha y medir solicitudes/citas/clics según el acuerdo. Registrar incidencias de licencias, productos descatalogados y sincronización.
9. Dar al chat capacidad de sugerir combinaciones de la tienda piloto solo desde IDs/variantes autorizados y un subconjunto acotado de productos físicamente aptos. El servidor comprueba SKU, dimensiones, licencia y disponibilidad antes de aceptar; Jev puede clasificar preferencias o puntuar relevancia, pero no inventa catálogo ni sustituye la comprobación comercial.

## Código afectado

- `prisma/schema/catalog.prisma` y migraciones acotadas; `src/app/api/catalog/`, `src/components/catalog/use-catalog-items.ts`.
- Editor v2 y servicio de catálogo común de la fase 3; adaptadores nuevos bajo `src/server/catalog/`.
- `src/addons/marketplace/server/catalog-seed.ts`, `catalog-repo.ts`, `src/app/api/marketplace/affiliate/route.ts` y atribución comercial, sin duplicar la entidad de producto.

## Criterios de aceptación

- Un producto de socio conserva comercio, SKU y variante desde importación hasta diseño, visita, vídeo y enlace de compra; el diseño aprobado no cambia si el feed se actualiza.
- Precios y stock se muestran con fecha de comprobación y se refrescan o se ocultan cuando caducan; un producto retirado permanece como referencia histórica del diseño sin anunciarse como comprable.
- Ninguna visualización se etiqueta «producto exacto» sin activo autorizado y validado. La versión aproximada sigue siendo útil para inspiración, pero no se confunde con el artículo real.
- El piloto registra clics/consultas de forma trazable y exhibe la naturaleza comercial de enlaces o posiciones patrocinadas.
- La petición «amuebla con productos de esta tienda» no coloca artículos ajenos, descatalogados o sin cabida; muestra los motivos y permite sustituirlos antes de aprobar.

## Riesgos

Los catálogos suelen tener variantes, formatos y licencias heterogéneos. Empezar por una importación pequeña y revisada; automatizar feeds solo después de medir calidad de datos, frescura y mantenimiento. Los acuerdos comerciales y la elección del primer socio son decisiones externas pendientes, no capacidades ya existentes.
