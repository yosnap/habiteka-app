# Controles del editor espacial

Implementación en la rama `feat/editor-v2`; no implica despliegue en producción.

## Cerrar una habitación

Con ajuste activo, al dibujar cerca de la intersección ortogonal con la prolongación de un extremo libre de la cadena, aparece una guía verde y el mensaje de cierre. El clic extiende esa pared y une el nuevo segmento en un vértice compartido, sin añadir un tramo residual. Deshacer revierte la unión completa. El ajuste tiene alcance de 12 píxeles de pantalla; no mueve esquinas compartidas ni paredes desconectadas.

## Pintar paredes

Seleccionar pared → Pintar → Interior o Exterior. La habitación cerrada determina las caras aunque se haya dibujado en sentido inverso. Un tabique compartido distingue las dos habitaciones interiores; si el contorno no permite identificar interior, el panel solicita cerrarlo.

Los dos acabados son independientes y solo aparecen en 3D. La coronación mantiene el color del trazo arquitectónico 2D; no hereda pintura de ninguna cara. La selección 3D usa contorno sin sustituir el acabado. Las texturas por cara no están implementadas.

En las esquinas, cada cara de la unión prolonga el acabado de su pared hasta el encuentro. La unión no lleva una franja neutra ni un único color compartido por todo el vértice.

## Suelo interior

El acabado del suelo es una superficie a nivel cero, sin una losa automática de 8 cm debajo. Se recorta contra las huellas reales de paredes y encuentros, respetando grosores distintos, habitaciones cóncavas y muros interiores. Los pasos de puerta a nivel cero conservan su umbral. Ocultar paredes para ver el interior no amplía el suelo.

## Tamaño, giro, elevación y comentarios

Los controles inferiores editan medidas en centímetros y ángulo en grados; muebles y escaleras giran alrededor de su centro. La elevación modifica su posición vertical, no su tamaño. Las colisiones consideran altura además de huella. Puertas y ventanas permanecen vinculadas a una pared.

Comentarios son notas de texto del proyecto vinculadas al elemento, no un chat ni una atribución de autoría. Pueden editarse/eliminarse desde su panel.

Paredes curvas siguen pendientes de implementación; no hay aún un control funcional de curvatura.
