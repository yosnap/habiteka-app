# Propiedades de puerta y motivos repetidos

- Ancho y posición disponen de deslizadores junto a las entradas precisas. Ancho en pasos de 1 cm, limitado al muro y a 10 m; posición limitada para que el hueco quepa. Se conserva la validación de solapamientos y el guardado existente.
- Retirado el bloque duplicado «Revisión de puertas y arcos». Seleccionar una puerta abre todas sus opciones en Propiedades.
- Causa del error React: cada guardado de una revisión bloqueada volvía a añadir el mismo motivo; la tarjeta utilizaba ese texto como clave. El guardado ahora elimina duplicados y la tarjeta también deduplica datos históricos, antes de recortar el modo compacto.
- Conservado el envío confirmado al Editor para continuar corrigiendo un plano con incidencias.

Validación: 14 pruebas dirigidas correctas, incluido guardar repetidamente sin acumular motivos y renderizar razones históricas duplicadas. TypeScript y ESLint correctos. Documentación de usuario y novedades actualizadas; `docs:updates` y `docs:build` correctos. Sin commit ni cambios en proyectos del usuario.

Preguntas pendientes: ninguna.
