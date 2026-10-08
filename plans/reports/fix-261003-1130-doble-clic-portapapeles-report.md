# Doble clic y portapapeles del Editor

- Doble clic abre Propiedades sobre la selección en Plano 2D y las vistas de escena. Conservados el cierre de contorno de luces y su panel específico; Mano y herramientas de dibujo no abren el inspector.
- Pulsar un canvas devuelve el foco al Editor sin desplazar la página. Evita que un campo de propiedades conserve el foco y bloquee los atajos de selección.
- Copiar/pegar por teclado admite puertas, ventanas y huecos además de objetos espaciales. Pegar genera un identificador nuevo y comienza la colocación; no modifica el documento hasta colocar. Un portapapeles sustituye al anterior y se respeta solo lectura.
- Conservada la preferencia de activar/desactivar atajos y la edición normal de texto.

Verificación: 7 pruebas dirigidas correctas; TypeScript y ESLint correctos. CUA en muestra independiente confirmó doble clic de armario, foco de un campo seguido de clic en lienzo, ⌘C/⌘V y colocación de la copia con nueva posición. Sin modificar el proyecto del usuario. Documentación y novedades actualizadas; comprobación y compilación de docs correctas. Sin commit ni despliegue.

Preguntas pendientes: ninguna.
