# Construcción breve y fuentes del diseño

Fecha: 01/10/2026. Rama: `feat/diseno-aprobado-visita-video`. Sin commit ni despliegue.

## Problema encontrado

El vídeo nativo leía geometría y muebles del editor. «Solo la casa» recortaba el ámbito a habitaciones cerradas/cubierta y excluía elementos exteriores. La selección de patio, rampas, escaleras y baño exterior registrada en los renders no gobernaba ese vídeo. Tampoco se interpretaba el mobiliario nuevo de las imágenes generadas. Por eso el MP4 podía diferir del diseño aunque utilizase la misma revisión del plano.

## Cambios

- Construcción nativa: 8 s por defecto o 12 s con más tiempo para muebles; muros consecutivos en 3 s. Duración, grabador, ticket, cámara y efectos usan la misma configuración. Construcción + visita suma la ruta al tiempo elegido.
- Construcción → Mis diseños abre el piloto H3 en KIE. El usuario elige una tanda de imágenes y ve vistas, zonas, guion, duración, calidad y coste antes de generar.
- Las opciones de ámbito de cada render quedan congeladas con la prueba. El guion pide todas las partes seleccionadas visibles, incluidos exteriores, y conserva cantidades, posiciones y acabado de muebles de las imágenes. No se envía un inventario del plano para reemplazarlos.
- Preparar no consume IA ni transfiere medios. Generar requiere confirmar las imágenes concretas y el presupuesto; se reserva saldo antes de subirlas. Se impiden doble envío y repetición automática de respuestas inciertas.
- El estado de la tarea queda en el proyecto. Consultar recupera la misma tarea y archiva el MP4 propio; el resultado exige revisión humana. Modificar una preparación aún no enviada permite ajustar selección/guion mediante borrado reversible de ese presupuesto.
- Guía pública y documentación técnica actualizadas en el mismo repositorio.

## Prueba preparada, sin pago

Proyecto FInca, revisión aprobada 156. Preparación `a417fe82-9687-4403-b548-39ed37594672`.

Seis imágenes: dron, isométrica, frontal, trasera, izquierda y cenital de la tanda `4954cc10-db5f-4901-9662-ef663c1cbb3e`.

Ámbito registrado: Dormitorio, Dormitorio 2, Salón / Cocina, Dormitorio 3, Baño, Baño exterior, Escalera 2, Descansillo 3, Estancia 1, Estancia 2, Rampa 1, Escalera 1. No se renombra automáticamente Estancia 1/2 como patio sin confirmación del contenido.

Duración 8 s, 768P, FX solicitados. Coste previsto $0.34/34 créditos Habiteka: $0.32 de salida y $0.02 por la sexta referencia. [Tarifa KIE H3](https://kie.ai/minimax-h3), contrastada 01/10/2026. No incluye auditorías ni nuevos intentos. `status=prepared`, sin tarea KIE. Ninguna imagen enviada al proveedor y ningún gasto de esta prueba. Pendiente autorización del presupuesto y envío de estas seis imágenes, incluida la parcela si está visible.

## Verificación

- 41 pruebas focalizadas del vídeo nativo; 17 del piloto. Cubren ámbito exterior, mobiliario según diseño, duración/precio, separación preparación/envío, confirmación, reserva previa, doble envío, errores ambiguos, recuperación y modificación concurrente.
- TypeScript y ESLint focalizado sin errores.
- `docs:updates` y construcción Astro/Starlight: 17 páginas, sin errores ni advertencias de Astro.
- Exportación nativa real `/Users/paulo/Downloads/habiteka-construccion (2).mp4`: 1920×1080, H.264 a 30 fps, AAC, 8.064 s. Hoja de fotogramas revisada: muros progresivos, tejado posterior y vuelo final. Esta prueba acredita duración/exportación, no fidelidad al interiorismo de los renders.
- Navegador real: seis referencias y doce zonas visibles en Crear vídeo; prueba persistente visible en Vídeos guardados, consentimiento sin marcar y Generar desactivado.

## Pendiente para aceptar la película

El proveedor recibe instrucciones, no una garantía geométrica. Hay que comprobar fotogramas contra las seis referencias: patio/exteriores, rampas/escaleras/baño exterior, muros, aleros/pérgolas, mobiliario y coherencia de luz. Si pierde elementos, se rechaza; rechazar no devuelve automáticamente el coste del proveedor ni inicia otra generación.

Conviene incorporar una referencia exterior cerrada con tejado terminado antes de producción. Las vistas seccionadas de distribución no fijan por sí solas todo el volumen final. Cotas exactas compuestas sobre IA, visita continua en primera persona desde diseños, auditoría automática y worker autónomo siguen pendientes. El importe registrado es estimado y aún falta conciliación con el coste real del proveedor. La fase 5 continúa abierta.
