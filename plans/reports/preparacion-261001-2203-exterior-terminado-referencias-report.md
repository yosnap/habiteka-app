# Exterior terminado y tanda de sustitución — 01/10/2026

## Implementado

- Ángulo **Exterior terminado** en Diseñar con IA: encuadre oblicuo del mismo ámbito, fachadas completas y cubierta visible. Captura identificada como `exterior`, sin confundirla con isométrica abierta.
- El recorte de integridad exige cubierta sólida y ausencia de corte en ese preset. La cenital se prepara/genera antes y aporta identidad del mismo diseño, luz y ámbito al exterior.
- Las zonas seleccionadas conservan su máscara, sin ortofoto ni elementos fuera de su ámbito. En vistas no aisladas se requiere la ortofoto como para las otras vistas lejanas.
- H3 exige referencia de distribución y exterior terminado de una misma tanda, tanto al preparar como al enviar. El estudio explica la ausencia del exterior y bloquea preparar. Las preparaciones antiguas tampoco evitan el control.

## Preparación real, sin generación IA

Proyecto FInca, aprobación 156. Se prepararon localmente **Cenital, Frontal, Trasera, Izquierda y Exterior terminado**, con Atardecer, libertad Controlado y fijos conservados.

Se seleccionaron de nuevo las doce zonas de la tanda anterior: Dormitorio, Dormitorio 2, Salón / Cocina, Dormitorio 3, Baño, Baño exterior, Escalera 2, Descansillo 3, Estancia 1, Estancia 2, Rampa 1 y Escalera 1. La selección se realizó en el mapa visible del editor; cada nombre se comprobó al añadirlo. Piscina, aparcamiento y resto de parcela quedan fuera.

Las cinco capturas pasaron la preparación de integridad. La ampliación de Exterior terminado muestra el tejado y los cerramientos, con pérgolas y accesos en el ámbito seleccionado y fondo gris. Son capturas para generar imágenes, no renders IA ya aceptados ni un vídeo nuevo.

Presupuesto mostrado por la aplicación: **0.40 USD por cinco imágenes**. Auditorías visuales adicionales. Se prepara una tanda coherente nueva porque la construcción exige referencias de una misma tanda; no se mezclan versiones visuales por el mero hecho de compartir revisión geométrica.

## Verificación

- 97 pruebas aprobadas en 11 archivos (capturas/cubiertas, preparación, opciones, galería, montaje, fuentes/acciones H3, referencias y prompts). Repetición dirigida de las 10 pruebas de acciones tras compartir el control de preparación/envío: correcta.
- TypeScript, ESLint de los módulos afectados y `git diff --check`: correctos.
- `npm run docs:updates` y `npm run docs:build`: correctos; 17 páginas HTML.
- Guías de imágenes, estudio de vídeo, novedades y documentación técnica actualizadas.
- Sin generación nueva, reservas ni cambios de límite. Saldo visible: 966 créditos. Límite global: 0 USD; gasto registrado de las últimas 24 h: 0.34 USD.

## Pendiente de autorización

La generación y auditoría de estas cinco imágenes es gasto nuevo. Antes de enviar capturas al proveedor se necesita un presupuesto adicional y permiso para habilitar temporalmente el límite global, restaurándolo a 0 al terminar. Otro vídeo H3 requiere autorización posterior tras revisar las imágenes. Sin commit ni despliegue.
