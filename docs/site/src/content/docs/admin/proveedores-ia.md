---
title: Proveedores y modelos de IA
description: Habilitar modelos de OpenRouter, NaN, OpenAI, APIMart u otro proveedor compatible con OpenAI y elegirlos por uso.
---

Esta página es para quien administra Habiteka. Además de OpenRouter, OpenAI, KIE y NaN (también para texto y visión), puedes añadir cualquier proveedor que acepte peticiones en el formato de OpenAI, como APIMart o NodeClub.ai. Basta con su URL base y su API key. Sus modelos aparecen después en **Modelos por uso**, junto a los demás.

Solo sirven para texto y visión: **Análisis visual**, **Asistente**, **Interpretación de planos** y **Memoria**. Las imágenes y los vídeos siguen con KIE, OpenRouter u OpenAI.

## Modelos de OpenRouter, NaN, OpenAI y KIE

OpenRouter, NaN y OpenAI traen unos modelos **incluidos de serie**, que ya aparecen en **Modelos por uso**. En la sección **Modelos de OpenRouter, NaN, OpenAI y KIE** de la pestaña **Configuración IA** puedes habilitar otros con la clave que ya tienes guardada:

1. En la tarjeta del proveedor, pulsa **Probar conexión y ver sus modelos**.
2. Filtra y pulsa el modelo. En OpenRouter y KIE el precio de entrada se rellena solo con el que publican (también se ve junto a cada modelo de la lista), y los modelos que no admiten imágenes se marcan como **solo texto**: no los uses para **Análisis visual**.
3. Marca los usos y pulsa **Habilitar modelo**. Aparece en **Modelos por uso**, dentro del grupo de su proveedor.

Un modelo incluido de serie no se puede habilitar otra vez para el mismo uso. Con OpenAI directo, elige modelos de chat (por ejemplo, de la familia GPT-5): la lista de OpenAI también trae modelos de imagen, audio o embeddings que no sirven para estos usos.

### Claude en KIE (Sonnet 5 y otros)

En KIE solo se pueden habilitar sus modelos **Claude** (por ejemplo, `claude-sonnet-5`) para estos usos; sus modelos de imagen siguen en **Render 3D** y **Edición de imágenes**. Usan la API key de KIE que ya tienes guardada.

- La lista de modelos Claude y su precio de entrada salen de la API de precios de KIE, la misma de su web (por ejemplo, Sonnet 5 a 0,85 USD por millón de tokens). Si esa API falla, la tarjeta muestra los de su documentación y el precio se escribe a mano. La clave se comprueba en la primera llamada.
- Todos admiten imágenes, así que sirven para **Análisis visual** (importar planos, **Amueblar** y la revisión de imágenes).
- KIE descuenta créditos en cada llamada y Habiteka registra ese coste real (1 crédito = 0,005 USD). El precio de entrada solo cuenta para el máximo de cada uso.
- En **Modelos por uso** aparecen en el grupo **KIE · Claude**.

## Configurar APIMart

APIMart ya viene preparado, con su URL `https://api.apimart.ai/v1`.

1. Abre **Modelos de IA por acción** (`/config/models`) y la pestaña **Configuración IA**.
2. En la tarjeta **APIMart · preconfigurado**, pega la API key de tu cuenta de APIMart y pulsa **Guardar**.
3. Mientras el proveedor no tenga modelos habilitados, su tarjeta carga sola la lista de modelos que ofrece (también con **Probar conexión y ver sus modelos**). Filtra por nombre, por ejemplo «sonnet», y pulsa el que quieras.
4. Comprueba su precio de entrada en USD por millón de tokens. En APIMart se rellena solo con el que publica, ya con su descuento por defecto; en otros proveedores escribe el de su web (0 si es gratuito o va incluido en tu suscripción), y marca los usos en los que se podrá elegir. Pulsa **Habilitar modelo**: debajo del botón verás «Modelo habilitado» o, si algo falla, el motivo en rojo. Sin este paso, el proveedor no aparece en **Modelos por uso**.
5. En **Modelos por uso**, elige ese modelo como primario o como respaldo. Aparece en el grupo **APIMart · OpenAI-compatible**.

## Añadir otro proveedor

Pulsa **Añadir proveedor** y rellena:

- **Nombre:** por ejemplo, NodeClub.ai. No puede coincidir con un proveedor integrado (OpenRouter, OpenAI, KIE, NaN o TypeSafe). El nombre no se cambia después.
- **URL base:** la dirección de su API, normalmente terminada en `/v1`, como `https://api.proveedor.com/v1`. Debe ser `https` y pública. No se admiten usuario y contraseña en la URL, parámetros, `localhost` ni direcciones de red privada.
- **API key:** se guarda cifrada y solo se envía a la URL de ese proveedor.

Después, prueba la conexión y habilita sus modelos igual que con APIMart.

Si un proveedor no publica su lista de modelos, **Probar conexión y ver sus modelos** lo indica: escribe el id a mano.

## Precio y límites

- Los precios se rellenan solos en OpenRouter, KIE y APIMart, que los publican por API; se consultan como mucho una vez por hora. NaN, OpenAI y NodeClub no los publican: escríbelos a mano.
- Un precio de 0 vale para modelos gratuitos o incluidos en una suscripción; su coste figura como 0.
- El precio que declaras se usa para estimar el coste si el proveedor no lo devuelve en cada respuesta. Esas llamadas figuran como coste **estimado**.
- Un modelo no puede superar el precio máximo del uso que elijas. Si lo supera, el panel lo rechaza y te indica el límite.
- Para cambiar la URL base hay que volver a pegar la API key. Sin cambiar la URL, puedes guardar sin clave para activar o desactivar el proveedor.
- No se puede quitar un modelo ni borrar un proveedor mientras un uso lo tenga como primario o respaldo. Cámbialo antes en **Modelos por uso**.
- Cada alta, cambio o baja queda registrada en la auditoría del panel.

## Si algo falla

- **La API key no es válida o no tiene acceso:** revisa la clave en la cuenta del proveedor y pégala de nuevo.
- **El proveedor responde con un error:** comprueba que la URL base termina donde empieza la API (normalmente en `/v1`). Si aun así no lista modelos, escribe el id a mano.
- **Un modelo no rinde bien en un uso:** déjalo como respaldo y mantén como primario un modelo probado.
- **No veo el proveedor en Modelos por uso:** no tiene modelos habilitados para ese uso. La tarjeta del uso lo avisa; habilítalos en la tarjeta del proveedor.
- **Qué modelo se usa:** siempre el primario de **Modelos por uso** y, si falla, sus respaldos en orden, sin excepciones. Importar un plano, **Amueblar** y la revisión automática de las imágenes generadas usan **Análisis visual**.
- **Un proveedor se queda sin saldo, está caído, no responde en 3 minutos o no devuelve el resultado completo:** se pasa al siguiente respaldo. Si ninguno responde, el aviso dice qué le pasó a cada modelo. Antes, un proveedor colgado podía tener la lectura de un plano esperando 10 minutos.
