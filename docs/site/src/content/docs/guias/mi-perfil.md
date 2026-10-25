---
title: Mi perfil
description: Resumen de la cuenta, datos personales, organización, claves de IA, modelos de IA de cada función y uso y costes de la IA.
---

**Mi perfil** reúne todo lo de tu cuenta y tu organización. Ábrelo desde **Mi perfil**, en la cabecera de la aplicación, o en `/perfil`. Tiene seis secciones en la columna de la izquierda (en el móvil, en una fila que se desplaza). Si administras Habiteka, al final aparece también **Administración**.

## Resumen

Muestra de un vistazo:

- **Claves de IA:** cuántos proveedores tienen clave y cuáles son.
- **Modelos elegidos:** en cuántas funciones has elegido tus propios modelos; el resto usa los recomendados.
- **Uso de IA · 30 días:** llamadas a la IA de tu organización y lo que han costado, en dólares, según tus proveedores (estimado cuando el proveedor no informa del importe). Pulsa la tarjeta para ver el detalle en **Uso y costes**.
- **Proyectos** y los **créditos** de la organización.

Debajo, **Para generar con IA** marca en verde lo que ya está hecho y en rojo lo pendiente, con un enlace a cada sección.

## Datos personales

- **Nombre:** cámbialo y pulsa **Guardar nombre**.
- **Correo electrónico:** es con el que entras y no se cambia desde aquí.
- **Contraseña:** escribe la actual y dos veces la nueva (al menos 8 caracteres) y pulsa **Cambiar contraseña**. Se cierran tus otras sesiones abiertas. Si entras sin contraseña (con un código por correo), no hay contraseña que cambiar.

## Organización

Los proyectos, las claves y los modelos son de la organización y los comparten todos sus miembros. Aquí ves su nombre y la lista de miembros con su rol. Solo el **propietario** o un **administrador** puede cambiar el nombre.

## Claves de IA

Las claves con las que Habiteka genera: se añaden, se prueban y se borran como explica [Claves de IA](/guias/claves-ia/).

## Modelos de IA

Cada función de Habiteka usa un modelo principal y, si falla o no tienes su clave, hasta tres respaldos en orden. Al principio, todas usan los **recomendados por Habiteka**. Cada tarjeta explica para qué sirve la función y qué conviene buscar en un modelo:

| Función | Para qué se usa | Qué conviene |
| --- | --- | --- |
| Asistente | Conversación del proyecto y propuestas | Texto rápido y con buen razonamiento |
| Análisis visual | Leer planos y fotos, Amueblar, revisar imágenes | Que admita imágenes |
| Interpretación de planos | Pasar un plano a muros, huecos y estancias | Visión y precisión; mejor gama alta |
| Memoria del proyecto | Redactar materiales y acabados | Que escriba bien en español |
| Imágenes del diseño | Imágenes hiperrealistas desde el plano | Que respete la geometría de la referencia |
| Retoques de imágenes | Cambiar una parte de una imagen aceptada | Que conserve lo que no se toca |

Para elegir los tuyos:

1. Pulsa **Elegir modelos** en la tarjeta de la función.
2. Elige el **principal** en el desplegable. Los modelos van agrupados por proveedor, con su precio (por millón de tokens en texto, por imagen en imágenes); los que marcan **sin clave** necesitan antes la clave de su proveedor.
3. Si quieres, pulsa **Añadir respaldo** (hasta tres) y quita los que sobren con la **X**.
4. Pulsa **Guardar**. La tarjeta pasa a **Tu elección** y debajo sigue viéndose lo que recomienda Habiteka.

**Usar los recomendados** devuelve la función a la recomendación. Si la tarjeta avisa de que **ahora no se puede usar**, te falta la clave de todos sus modelos: añádela en [Claves de IA](/guias/claves-ia/).

Solo el propietario o un administrador de la organización elige los modelos. Se ofrecen los del catálogo de Habiteka y los que tu organización habilite en [Claves de IA](/guias/claves-ia/#habilitar-más-modelos-de-un-proveedor), de sus proveedores o de proveedores compatibles que añada.

### Recomendaciones

Las recomendaciones de cada función son fijas y las mantiene Habiteka: no las cambia nadie desde la administración. Si una versión nueva de Habiteka cambia una recomendación:

- Las funciones que **no** has personalizado pasan a usar el nuevo modelo recomendado.
- Las que **sí** has personalizado siguen con tu elección.
- Si un modelo que habías elegido deja de estar disponible (Habiteka lo retira o tu organización lo quita), se salta. Si no te queda ninguno en esa función, vuelve a la recomendación.

### Vídeos

Los vídeos no se eligen aquí: Habiteka usa un modelo fijo para cada tipo, con tu clave de KIE. El paseo por las zonas usa **Hailuo 02 estándar**, en tramos de 6 o 10 segundos a 768p. La construcción y la visita usan **MiniMax H3** con varias imágenes aceptadas como referencia.

## Uso y costes

Lo que tu organización ha usado de la IA y lo que le han cobrado sus proveedores. Solo ves los datos de tu organización. Arriba eliges las fechas (por defecto, los últimos 30 días, en UTC), cómo agrupar (por **función**, **modelo**, **proveedor**, **proyecto** o **persona**) y si la evolución es diaria o mensual. Pulsa **Aplicar**.

- **Coste:** la suma de lo **confirmado** por el proveedor y lo **estimado** con el precio del modelo cuando el proveedor no informa del importe. Los intentos sin importe conocido se indican aparte y no cuentan como cero.
- **Peticiones:** cuántas veces se pidió algo a la IA, cuántos intentos hicieron falta y cuántos usaron un modelo de respaldo.
- **Errores** y **Tiempo medio** por intento.
- **Evolución del gasto:** una barra por día o por mes, en verde lo confirmado y en ámbar lo estimado.
- **Reparto:** una fila por función, modelo, proveedor, proyecto o persona, según la agrupación, con intentos, errores y coste.
- **Por qué fallaron:** los errores por causa, por ejemplo **Falta la clave del proveedor**, **Proveedor caído o clave rechazada** o **El proveedor no respondió a tiempo**.

Debajo, **Eficacia: comprobaciones de calidad** resume lo que hizo Jev con tus generaciones. Jev comprueba antes de gastar si el plano o la petición son fiables, y después puntúa el resultado de 0 a 100. Su coste lo paga Habiteka, no tu organización.

- **Comprobaciones:** cuántas hubo y cuántas siguieron o pidieron confirmación.
- **Generaciones frenadas** y **Gasto evitado:** los bloqueos que evitaron pagar una generación poco fiable, estimados con el coste medio de tus generaciones.
- **Aceptado sin rehacer**, **Rehecho con retoques** y **Sin puntuar:** cómo se reparte lo que gastaste en entregables.
- Una línea por punto de control con sus comprobaciones, bloqueos y nota media.

Úsalo para decidir en **Modelos de IA** qué modelo te compensa: cuánto cuesta, cuánto falla y qué nota sacan sus resultados.
