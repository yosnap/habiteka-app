# Política de retención de datos

> Documento técnico-legal base. Los plazos son valores por defecto **propuestos**;
> confírmalos con criterio jurídico/de negocio antes de publicar.

## Principio

Conservamos cada dato solo el tiempo necesario para su finalidad (minimización,
art. 5.1.e). El contenido borrado por el usuario pasa a una **papelera**
(soft-delete) y, vencido su plazo, se elimina de forma **definitiva** (hard-delete)
de la base de datos y del almacenamiento de objetos.

## Soft-delete vs supresión

- **Soft-delete** (`deletedAt`): borrado lógico. El dato queda oculto pero
  recuperable durante el plazo de retención (papelera / soporte / deshacer).
- **Supresión RGPD (art. 17)** y **purga por retención**: borrado **real** de
  filas y objetos. La supresión a petición del interesado es inmediata; la purga
  por retención la ejecuta un job programado.

## Plazos por tipo de dato

| Tipo de dato | Plazo en papelera (soft → hard) | Notas |
|---|---|---|
| Proyectos y su contenido (canvas, mensajes, entregables) | **30 días** (`DEFAULT_RETENTION_MS`) | Configurable |
| Imágenes de origen subidas | Igual que su proyecto | Se borran con el proyecto |
| Renders / planos generados | Igual que su proyecto | Objetos en storage borrados con el proyecto |
| Registro de consentimiento | Mientras dure la relación + plazo de prescripción | Prueba de consentimiento (art. 7.1) |
| `CreditLedger` (auditoría de créditos) | No se borra | **No contiene PII**, solo refs/ids |
| Logs | Solo metadatos, sin PII | _(plazo según operación)_ |

## Ejecución

- **Supresión a petición:** `eraseOrganizationData` (borrado real, DB + storage).
- **Purga por retención:** `purgeExpiredSoftDeletes` (job programado; convierte en
  hard-delete lo que excede el plazo en papelera). El disparo del cron se coordina
  con la infraestructura (F11).

## Subencargados

El borrado en sistemas de terceros (OpenRouter, proveedor de imagen) es
**best-effort** según el contrato y la retención de cada proveedor. No se garantiza
la eliminación total fuera de nuestros sistemas (ver `privacy-policy.md` §5).
