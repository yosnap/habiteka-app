# Borrador legal: claves de IA de terceros

**Estado:** borrador para revisar por Paulo o su asesoría. No está publicado. Cambiar `docs/legal/tos/terms-of-service.md` sube la versión y obliga a todos los usuarios a aceptarla de nuevo.

## Cómo funciona hoy (para redactar sobre hechos)

- Cada organización pega la clave de su proveedor de IA (OpenRouter, KIE, OpenAI, NaN o uno compatible).
- La clave se cifra en el servidor con AES-256-GCM antes de guardarla. La clave de cifrado es `ADMIN_SECRETS_KEY`, propia del servidor y obligatoria en producción.
- La clave en claro no se guarda en la base, no se escribe en registros y no vuelve al navegador. Solo se conserva el texto cifrado y una pista con los 4 últimos caracteres.
- Nadie puede volver a verla, tampoco la administración de Habiteka. El usuario solo puede sustituirla o borrarla.
- Solo se descifra en memoria para llamar a su proveedor, desde las funciones que pide un miembro de la organización. Solo se envía a ese proveedor: un compatible, únicamente a la URL con la que se guardó.
- Borrar la clave elimina la fila al momento. Las copias de seguridad de la base contienen el texto cifrado hasta que caducan.
- El coste lo cobra el proveedor directamente al usuario. Habiteka no factura ese uso.
- Límite técnico: para llamar al proveedor, el servidor necesita la clave en memoria durante la llamada. No existe un diseño que lo evite si la generación se hace en el servidor.

## Cláusula propuesta para los Términos de Servicio

> **X. Claves de proveedores de inteligencia artificial**
>
> X.1. Para usar las funciones de IA, la organización aporta sus propias claves de API de proveedores de terceros (por ejemplo, OpenRouter, KIE u OpenAI). Las obtiene, contrata y paga directamente al proveedor, bajo las condiciones de ese proveedor, de las que Habiteka no forma parte.
>
> X.2. Habiteka usa cada clave solo para hacer, en nombre de la organización, las llamadas al proveedor que piden sus miembros desde las funciones de la aplicación. No la usa para ningún otro fin, no la cede a terceros y solo la envía al proveedor al que pertenece.
>
> X.3. Las claves se guardan cifradas y no se pueden volver a consultar, tampoco por Habiteka. La organización puede sustituirlas o borrarlas en cualquier momento desde Mi perfil.
>
> X.4. La organización responde de que tiene derecho a usar las claves que aporta, de su custodia fuera de Habiteka y de los consumos que generen sus miembros. También responde de cumplir las condiciones de su proveedor. Si sospecha que una clave se ha visto comprometida, debe revocarla en el proveedor y borrarla de Habiteka.
>
> X.5. Habiteka no responde de los importes que el proveedor cobre por el uso solicitado por la organización, ni de las interrupciones, cambios de precio o decisiones del proveedor. Tampoco responde de un uso de la clave hecho fuera de Habiteka.

## Para la política de privacidad y el registro de actividades

- **Dato:** clave de API de un proveedor de IA, que puede identificar la cuenta del cliente ante ese proveedor.
- **Finalidad:** ejecutar las funciones de IA que pide la organización.
- **Base jurídica:** ejecución del contrato (art. 6.1.b RGPD).
- **Conservación:** mientras la organización no la borre. En las copias de seguridad, cifrada, hasta que caducan según `docs/legal/data-retention.md`.
- **Medidas:** cifrado en reposo con clave propia, sin acceso de lectura para nadie, envío solo al proveedor correspondiente y sin registro en logs.
- **Destinatarios:** el propio proveedor elegido por la organización, que recibe la clave para autenticar sus llamadas. Revisar si alguno implica una transferencia internacional (la mayoría están en EE. UU.).

## Pendiente de decidir

- Si la cláusula entra ya en una nueva versión de los Términos, con la aceptación de nuevo que eso supone, o con la siguiente revisión.
- Si se avisa por correo a las organizaciones actuales de que tienen que aportar sus propias claves.
