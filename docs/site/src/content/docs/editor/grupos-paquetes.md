---
title: Bloqueos, grupos y paquetes
description: Protege elementos, organiza conjuntos reutilizables y sustituye piezas desde el catálogo.
---

## Bloquear elementos

En **Escena**, cada fila tiene un **candado antes del ojo**. Pulsa el candado para impedir que el elemento se mueva, se edite, se sustituya o se elimine. Puedes seguir localizándolo y cambiar su visibilidad de trabajo.

Si pertenece a un grupo, bloquear cualquier pieza bloquea todo el grupo. Desbloquear una de sus piezas libera el conjunto. También se protegen las piezas dependientes: una puerta bloqueada impide modificar la pared que la sostiene si ese cambio la afecta. Si el bloqueo procede del contenedor, desbloquear la pieza libera ese origen del bloqueo.

Una edición múltiple que afecte a un elemento bloqueado se rechaza completa. Los bloqueos se guardan en el documento del proyecto y en su planta. Bloquear y desbloquear son acciones que puedes deshacer y rehacer; el candado protege la edición, no sustituye los permisos de acceso al proyecto.

## Agrupar dentro del proyecto

1. Selecciona las piezas en el plano o en Escena. **Mayús, Ctrl o Cmd + clic** permiten añadir o quitar elementos.
2. En **Escena** o **Propiedades**, pulsa **Agrupar**, escribe un nombre y confirma **Crear grupo**.
3. El conjunto aparece en **Escena → Grupos**, tanto en Estructura como en Mobiliario. Abre **Ver contenido** para ver sus piezas.

Un clic selecciona el grupo; arrastrar una pieza o usar las flechas mueve el conjunto. **Doble clic sobre una pieza en Escena** abre sus propiedades individuales. También puedes elegirla en el buscador de Propiedades. Para separar las piezas, selecciona el conjunto y pulsa **Desagrupar**.

Los grupos pertenecen a una planta y cada elemento puede estar en un solo grupo. Agrupar piezas de grupos existentes reúne esos conjuntos. Eliminar una pieza agrupada elimina el conjunto completo; desagrupa primero si quieres retirar solo una. Deshacer recupera los elementos y su grupo.

## Guardar y reutilizar paquetes

**Guardar como paquete** guarda una copia de la selección con un nombre y una miniatura de su distribución. Si seleccionas una pieza agrupada, incluye el grupo completo. No es necesario agrupar previamente.

La biblioteca **Mis paquetes** pertenece a **tu cuenta**: está disponible en **todos tus proyectos y dispositivos** al iniciar sesión con el mismo usuario. Se abre desde **Amueblar**, **Construir**, **Escena** o **Propiedades**. Incluye un buscador y los filtros **Todos · Muebles · Construcción · Mixtos**. Otros usuarios no acceden a tu biblioteca personal por compartir un proyecto.

Pulsa **Colocar en el plano**: el editor abre Plano 2D y muestra el contorno del paquete bajo el puntero. Haz clic para colocarlo; **Esc** cancela. Coloca o cancela el paquete antes de cambiar de vista. Si la posición introduce una colisión o una geometría inválida, el paquete queda pendiente para elegir otro lugar. Su inserción se puede deshacer de una vez.

Cada inserción crea elementos nuevos y un grupo independiente cuando hay varias piezas. Mantiene medidas, giros, acabados y posiciones relativas. Cambiar una copia no modifica el paquete guardado ni las demás copias. Los paquetes se insertan desbloqueados.

Los paquetes pueden combinar mobiliario y construcción: mesas con sillas, camas con mesillas, conjuntos de salón o paredes con sus puertas. Se incluyen los soportes necesarios: una abertura necesita su pared; una luminaria necesita su techo y el contorno que lo sostiene. Revisa la miniatura para conocer el alcance del conjunto.

Cada paquete admite **hasta 300 elementos y 1 MB**. No incluye comentarios, referencias geográficas, imágenes privadas ni recorridos vinculados a diseños. Los recorridos no se pueden guardar como paquetes. Los muebles y la geometría del paquete siguen siendo guías de preparación; no sustituyen diseños IA aceptados.

**Eliminar de la biblioteca** pide confirmación y retira el paquete guardado. Conserva todas las copias ya insertadas en proyectos. Esta operación de biblioteca no forma parte del historial del plano.

## Sustituir una pieza

Selecciona un mueble y pulsa **Propiedades → Acciones del elemento → Sustituir**, o **Sustituir** en su menú contextual. Elige el reemplazo en el catálogo.

Se conservan el centro, el giro, la elevación y la pertenencia al grupo. El nuevo modelo usa sus propias dimensiones y acabados, sin deformarlo para igualar al anterior. Si no cabe o no admite los objetos apoyados sobre él, el original se conserva y aparece el motivo.

Para cambiar solo el sofá de un conjunto, abre sus propiedades individuales desde Escena. **Deshacer** recupera el modelo anterior. Un elemento bloqueado requiere desbloquear su grupo antes de sustituirlo.

Las **puertas y ventanas** también ofrecen Sustituir con su catálogo de tipos. Conservan el muro y la posición; aplican las medidas del tipo cuando caben, siguiendo las reglas del editor de aberturas. Paredes, escaleras, rampas y tramos de cocina se modifican con sus controles específicos de Propiedades.
