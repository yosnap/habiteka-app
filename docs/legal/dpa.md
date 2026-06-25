# Acuerdo de tratamiento de datos (DPA) y subencargados

> Documento técnico-legal base. **Requiere revisión jurídica** y la firma de los
> DPA reales con cada subencargado antes de operar con datos de la UE.

## Roles

- **Responsable del tratamiento:** el usuario/organización que sube las imágenes
  decide la finalidad. En el caso B2B (administradores de finca, votación de
  vecinos), el responsable es la organización contratante.
- **Encargado del tratamiento:** Habiteka, que trata los datos por cuenta del
  responsable para prestar el servicio.
- **Subencargados:** los proveedores que Habiteka usa para tratar los datos (IA,
  almacenamiento). Requieren un DPA conforme al art. 28 RGPD.

## Subencargados

| Subencargado | Finalidad | Datos tratados | Ubicación | Garantía de transferencia |
|---|---|---|---|---|
| **OpenRouter** (gateway de IA) | Chat / visión sobre las imágenes | Imágenes saneadas, prompts | Variable por modelo | Allowlist por jurisdicción + SCCs / zero-retention _(verificar por contrato)_ |
| **Proveedor de imagen** (render) | Generación de render/planos | Imágenes saneadas | _(según proveedor)_ | _(SCCs / UE — verificar)_ |
| **Object storage (S3 / MinIO)** | Almacenamiento de imágenes y entregables | Imágenes, renders | _(según despliegue)_ | _(UE o SCCs según ubicación del bucket)_ |
| **Proveedor de email** | OTP / verificación | Email | _(según proveedor)_ | _(verificar)_ |
| **Proveedor de pagos (Polar)** | Facturación (Merchant of Record) | Datos de facturación | _(según Polar)_ | _(verificar)_ |

## Obligaciones de los subencargados (art. 28)

- Tratar los datos solo según las instrucciones documentadas del responsable.
- Confidencialidad, medidas de seguridad (art. 32) y notificación de brechas.
- **Opt-out de entrenamiento:** los datos enviados a modelos de IA **no deben
  usarse para entrenar** (verificar y exigir por contrato).
- Asistencia en el ejercicio de derechos y en la supresión (best-effort, ver
  política de privacidad §5).

## Routing de IA y jurisdicción

El routing de IA consulta la allowlist por jurisdicción
(`src/server/privacy/jurisdiction-allowlist.ts`): solo se seleccionan modelos con
garantías de transferencia adecuadas. El routing por defecto del gateway es no
determinista y **no** debe usarse para datos personales sin esta restricción.
