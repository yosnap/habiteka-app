# Registro de actividades de tratamiento (RAT) — art. 30 RGPD

> Documento técnico-legal base. **Requiere revisión jurídica** y la cumplimentación
> de los campos del responsable antes de su uso oficial.

## Datos del responsable

_(Razón social, contacto, DPO si aplica.)_

## Actividades de tratamiento

### A1 — Cuenta y autenticación
- **Finalidad:** alta y acceso al servicio.
- **Categorías de interesados:** usuarios registrados.
- **Categorías de datos:** nombre, email, identificadores de auth.
- **Base legal:** ejecución del contrato.
- **Conservación:** mientras la cuenta esté activa.
- **Destinatarios:** proveedor de email (OTP/verificación).

### A2 — Tratamiento de imágenes con IA
- **Finalidad:** generar planos, renders y memorias a partir de fotos de viviendas.
- **Categorías de interesados:** usuarios; **terceros** que puedan aparecer en las
  fotos (vecinos, viandantes — riesgo de menores, art. 8).
- **Categorías de datos:** imágenes de viviendas (dato personal, potencialmente
  sensible por ubicación/patrimonio), prompts.
- **Base legal:** consentimiento explícito (imágenes) + contrato (servicio).
- **Conservación:** ver `data-retention.md`.
- **Transferencias:** subencargados de IA, posible fuera del EEE, con allowlist de
  jurisdicción + SCCs (ver `dpa.md`).
- **Medidas:** minimización (strip EXIF/geo + difuminado de caras), aislamiento por
  `organizationId`, cifrado en tránsito/reposo.

### A3 — Facturación
- **Finalidad:** cobro del servicio.
- **Base legal:** obligación legal + contrato.
- **Destinatarios:** proveedor de pagos (Polar, Merchant of Record).
- **Conservación:** plazos fiscales aplicables.

### A4 — Registro de consentimiento
- **Finalidad:** prueba de consentimiento (art. 7.1).
- **Datos:** usuario, propósito, versión de política, timestamp, otorgado/revocado.
- **Base legal:** obligación de responsabilidad proactiva (art. 5.2).

### A5 — Votación de vecinos (add-on, B2B)
- **Finalidad:** decisiones comunitarias sobre propuestas de diseño.
- **Roles:** la organización (administrador de finca) es responsable; Habiteka,
  encargado. Requiere **contrato art. 28** y **control de edad**. _(Detalle en F9.)_

## Medidas de seguridad transversales (art. 32)

- PII nunca en logs ni en el `CreditLedger` (solo refs/ids).
- Aislamiento estructural por organización (`withOrg`).
- Supresión real verificable (sin huérfanos en DB ni storage propios).
- Cifrado en tránsito y en reposo del object storage.
