# Evaluación de impacto relativa a la protección de datos (DPIA) — art. 35 RGPD

> Documento técnico-legal base. **Requiere revisión jurídica** y, si el riesgo
> residual es alto, **consulta previa a la autoridad de control** (art. 36).
> Distinta del RAT (art. 30, ver `../records-of-processing.md`).

**Versión:** `2026-06` · **Estado:** borrador para revisión

## 1. ¿Es obligatoria?

Sí, con alta probabilidad. El tratamiento reúne varios criterios de las
Directrices del CEPD (WP248):

- **Tratamiento a gran escala** de imágenes de domicilios (dato personal
  potencialmente sensible: ubicación, situación patrimonial).
- **Posible aparición de terceros y menores** en las fotografías.
- **Uso de tecnología innovadora** (IA generativa / visión) con transferencias
  internacionales no triviales.

## 2. Descripción del tratamiento

- **Finalidad:** generar diseño conceptual a partir de fotos de viviendas.
- **Datos:** imágenes (con posible PII de terceros), prompts, datos de cuenta.
- **Flujos:** subida → minimización (EXIF/geo + blur de caras) → IA (subencargados)
  → entregables → almacenamiento. Ver RAT y `../dpa.md`.

## 3. Necesidad y proporcionalidad

- **Base legal:** consentimiento explícito (imágenes) + contrato (servicio).
- **Minimización:** strip de EXIF/geo y difuminado de caras antes de la IA; solo se
  envía lo necesario.
- **Limitación de conservación:** retención por TTL + supresión real (art. 17).

## 4. Riesgos para los derechos y libertades

| Riesgo | Probabilidad | Gravedad | Medida mitigadora |
|---|---|---|---|
| Exposición de domicilio/patrimonio | Media | Alta | Minimización, aislamiento por organización, cifrado |
| Tratamiento de terceros/menores en fotos | Media | Alta | Blur de caras; ToS responsabiliza al usuario; base legal documentada |
| Transferencia internacional sin garantías | Media | Alta | Allowlist de jurisdicción con SCCs/UE/zero-retention |
| Uso del output para obra sin validación → daño físico | Media | Crítica | ToS: validación profesional como condición + limitación de responsabilidad |
| Persistencia de datos tras la supresión | Baja | Alta | Borrado real DB+storage; best-effort en subencargados informado |
| Reidentificación a partir de imágenes | Baja | Media | Minimización; no perfilado de personas |

## 5. Riesgo residual

_(A determinar tras aplicar las medidas. Si se mantiene alto en algún flujo,
valorar la consulta previa del art. 36 antes del lanzamiento UE.)_

## 6. Revisión

La DPIA se revisa ante cambios sustanciales del tratamiento (nuevo subencargado,
nueva finalidad, cambio de jurisdicción de los modelos) o, en su defecto,
periódicamente.
