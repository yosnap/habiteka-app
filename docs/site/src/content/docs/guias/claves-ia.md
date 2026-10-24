---
title: Claves de IA de tu organización
description: Añadir, probar y borrar las claves de OpenRouter, KIE, OpenAI y otros proveedores con las que Habiteka genera.
---

Habiteka genera los diseños, las imágenes, el asistente y los vídeos con **las claves de IA de tu organización**. Cada uso lo cobra el proveedor directamente en tu cuenta. Habiteka no añade ningún cargo y no usa claves de la plataforma por ti.

Ábrelas en **Mi perfil › Claves de IA** (en la cabecera de la aplicación, **Mi perfil**), o en `/perfil/claves-ia`. La dirección anterior, `/ajustes/claves-ia`, te lleva allí.

## Qué proveedores admite

La página muestra una tarjeta por proveedor:

- **OpenRouter**: texto, visión e imágenes con muchos modelos.
- **KIE**: imágenes, vídeos y sus modelos Claude de texto y visión.
- **OpenAI**: texto, visión y GPT Image.
- **NaN**: texto y visión.
- Los proveedores compatibles con OpenAI que haya añadido la administración de Habiteka, como **APIMart**.

Cada función usa un modelo principal y sus respaldos: los recomendados por Habiteka o los que elijas en [Mi perfil › Modelos de IA](/guias/mi-perfil/#modelos-de-ia). Para que una función se pueda usar, tu organización necesita la clave del proveedor de alguno de esos modelos. Si te falta la del principal pero tienes la de un respaldo, se usa el respaldo.

## Añadir una clave

1. Crea la clave en la web del proveedor (por ejemplo, en la sección *API keys* de tu cuenta).
2. En la tarjeta del proveedor, pégala en **API key** y pulsa **Guardar**.
3. Pulsa **Probar**. Habiteka consulta al proveedor la lista de modelos, o el saldo en el caso de KIE, sin generar nada ni gastar tokens. Verás **Clave válida** o el motivo del rechazo.

La clave se guarda cifrada. Después solo se muestran sus cuatro últimos caracteres (por ejemplo, `••••a1b2`). Para sustituirla, pega la nueva y pulsa **Guardar**.

## Borrar una clave

Pulsa **Borrar** y confirma con **Sí, borrar**. Las funciones que solo podían usar ese proveedor quedan bloqueadas hasta que añadas otra clave.

## Quién puede cambiarlas

Las claves son de la organización, no de cada persona. Solo el **propietario** o un **administrador** de la organización puede guardarlas, probarlas o borrarlas. El resto de miembros ve qué proveedores tienen clave, pero no puede cambiarlas.

## Si una función dice que falta una clave

Al generar sin la clave necesaria, Habiteka no envía nada al proveedor y muestra un aviso como este:

> Para usar esta función, tu organización necesita su propia clave de OpenRouter o OpenAI. Añádela en Ajustes › Claves de IA.

Añade una de las claves que nombra el aviso y vuelve a intentarlo. No hace falta esperar: la siguiente generación ya la usa.

## Qué no cambia

- Los créditos y la confirmación de gasto antes de cada imagen o vídeo funcionan igual. El importe que muestran es una estimación de lo que cobrará tu proveedor.
- La comprobación de calidad de Jev sigue a cargo de la plataforma y no necesita clave tuya.
