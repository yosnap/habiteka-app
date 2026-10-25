---
title: Administración de la plataforma
description: Qué gestiona la administración de Habiteka y cómo se configura Jev, la comprobación de calidad.
---

Esta página es para quien administra Habiteka. El panel de **Administración** solo gestiona personas y plataforma:

- **Usuarios**.
- **Ajustes de sistema**: Jev y sus umbrales, y los parámetros de la plataforma.
- **Media** y **Analítica**.

La inteligencia artificial de generación no se administra aquí. Cada organización añade sus claves, habilita sus modelos y proveedores compatibles, elige qué modelo usa cada función y consulta sus costes y su eficacia en [Mi perfil](/guias/mi-perfil/). La cuenta admin también genera con las claves de su propia organización. Las recomendaciones de modelos por función son fijas y vienen con cada versión de Habiteka.

## Jev: la comprobación de calidad

En **Ajustes de sistema › Calidad de las generaciones: Jev (TypeSafe)**:

- **Qué hace:** antes de que una organización gaste en una imagen, un plano o una memoria, Jev comprueba si el plano o la petición son fiables y decide si se sigue, si se pide confirmación o si se frena. Después puntúa el resultado de 0 a 100. No genera contenido.
- **Por qué hace falta:** evita que los usuarios paguen a su proveedor generaciones que saldrían mal. Su coste lo asume la plataforma con esta clave, la única clave de IA que guarda Habiteka. Sin ella, o desactivada, las comprobaciones no se hacen y se genera sin ese filtro.
- **Dónde conseguir la clave:** en la [consola oficial de TypeSafe](https://console.typesafe.ai/), en el apartado de claves de API ([documentación](https://docs.typesafe.ai/introduction)). TypeSafe publica 42 USD por cada mil millones de tokens de entrada. Algunos intermediarios, como OpenRouter, también lo ofrecen, pero Habiteka llama directamente a la API de TypeSafe: solo sirve una clave de TypeSafe.

Pega la clave, marca **Habilitar las evaluaciones de calidad con Jev** y pulsa **Guardar Jev**. Sin pegar una clave nueva puedes activar o desactivar la guardada. La clave se cifra al guardarla y no se vuelve a mostrar. Los umbrales de decisión se ajustan justo debajo.

## Qué ya no está en la administración

**Proveedores y modelos**, **Productos**, **Facturación**, **Costes IA** y **Eficacia IA** se han retirado. Las claves que tenía la plataforma, sus proveedores compatibles, sus modelos habilitados y su mapeo de modelos pasaron a la organización de la cuenta admin.
