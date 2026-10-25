---
title: Claves de IA de tu organización
description: Añadir, probar y borrar las claves de tus proveedores de IA, habilitar sus modelos y añadir proveedores compatibles.
---

Habiteka genera los diseños, las imágenes, el asistente y los vídeos con **las claves de IA de tu organización**. Cada uso lo cobra el proveedor directamente en tu cuenta. Habiteka no añade ningún cargo y no usa claves de la plataforma por ti.

Ábrelas en **Mi perfil › Claves de IA** (en la cabecera de la aplicación, **Mi perfil**), o en `/perfil/claves-ia`. La dirección anterior, `/ajustes/claves-ia`, te lleva allí.

## Qué proveedores admite

La página muestra una tarjeta por proveedor:

- **OpenRouter**: texto, visión e imágenes con muchos modelos.
- **KIE**: imágenes, vídeos y sus modelos Claude de texto y visión.
- **OpenAI**: texto, visión y GPT Image.
- **NaN**: texto y visión.
- **APIMart**, preparado: basta con pegar su clave.
- Los proveedores compatibles con OpenAI que añadas tú (ver más abajo).

Cada función usa un modelo principal y sus respaldos: los recomendados por Habiteka o los que elijas en [Mi perfil › Modelos de IA](/guias/mi-perfil/#modelos-de-ia). Para que una función se pueda usar, tu organización necesita la clave del proveedor de alguno de esos modelos. Si te falta la del principal pero tienes la de un respaldo, se usa el respaldo.

## Añadir una clave

1. Crea la clave en la web del proveedor (por ejemplo, en la sección *API keys* de tu cuenta).
2. En la tarjeta del proveedor, pégala en **API key** y pulsa **Guardar**.
3. Pulsa **Probar**. Habiteka consulta al proveedor la lista de modelos, o el saldo en el caso de KIE, sin generar nada ni gastar tokens. Verás **Clave válida** o el motivo del rechazo.

Para sustituirla, pega la nueva y pulsa **Guardar**.

## Cómo protege Habiteka tus claves

- Al guardarla, la clave se cifra en el servidor. En la base de datos solo queda el texto cifrado y sus cuatro últimos caracteres (por ejemplo, `••••a1b2`), para que la reconozcas.
- Nadie puede volver a verla entera: ni tú, ni otros miembros, ni la administración de Habiteka. Solo puedes sustituirla o borrarla.
- Solo se usa para lo que pides: se descifra en memoria en el momento de llamar a su proveedor desde una función de Habiteka y solo se envía a ese proveedor. No se guarda en registros ni vuelve al navegador.
- Si crees que una clave se ha visto comprometida, revócala en la web del proveedor y bórrala aquí.

## Habilitar más modelos de un proveedor

Cada función ya tiene modelos del catálogo de Habiteka. Para elegir otros en [Modelos de IA](/guias/mi-perfil/#modelos-de-ia), habilítalos aquí (solo para texto y visión: asistente, análisis visual, interpretación de planos y memoria):

1. Abre **Modelos** en la tarjeta del proveedor. Verás los **incluidos en el catálogo de Habiteka** y los **habilitados por tu organización**.
2. Pulsa **Ver los modelos del proveedor**. Habiteka pide la lista con tu clave, sin gastar tokens. En KIE salen sus modelos Claude.
3. Filtra y pulsa un modelo. En OpenRouter, KIE y APIMart el precio de entrada se rellena solo; en los demás escribe el de su web (0 si es gratuito o va en tu suscripción). Los modelos que no admiten imágenes se marcan como **solo texto**: no los uses para **Análisis visual**.
4. Marca los usos y pulsa **Habilitar modelo**. **Quitar** lo retira; las funciones que lo usaban siguen con el resto de su cadena o con la recomendación.

## Añadir un proveedor compatible con OpenAI

Si tu proveedor acepta el formato de OpenAI (`/chat/completions` y `/models`), como NodeClub.ai, añádelo en **Añadir un proveedor compatible con OpenAI**: nombre, URL base de su API (por ejemplo, `https://api.proveedor.com/v1`) y su API key. La URL debe ser `https` y de un servidor público. La clave solo se envía a esa URL; si cambias la URL, tienes que pegarla de nuevo. Después habilita sus modelos en su tarjeta. **Quitar proveedor** borra el proveedor, su clave y sus modelos.

## Borrar una clave

Pulsa **Borrar** y confirma con **Sí, borrar**. Las funciones que solo podían usar ese proveedor quedan bloqueadas hasta que añadas otra clave.

## Quién puede cambiarlas

Las claves son de la organización, no de cada persona. Solo el **propietario** o un **administrador** de la organización puede guardarlas, probarlas o borrarlas, y habilitar modelos o proveedores. El resto de miembros ve qué proveedores tienen clave, pero no puede cambiarlas.

## Si una función dice que falta una clave

Al generar sin la clave necesaria, Habiteka no envía nada al proveedor y muestra un aviso como este:

> Para usar esta función, tu organización necesita su propia clave de OpenRouter o OpenAI. Añádela en Ajustes › Claves de IA.

Añade una de las claves que nombra el aviso y vuelve a intentarlo. No hace falta esperar: la siguiente generación ya la usa.

## Qué no cambia

- Los créditos y la confirmación de gasto antes de cada imagen o vídeo funcionan igual. El importe que muestran es una estimación de lo que cobrará tu proveedor.
- La comprobación de calidad de Jev sigue a cargo de la plataforma y no necesita clave tuya.
- La cuenta de administración de Habiteka también genera con las claves de su organización: no hay claves comunes.
