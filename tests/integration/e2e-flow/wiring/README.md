# Wiring del flujo vivo (F-INT)

Bitácora del **ensamblaje real** del flujo y de los gates transversales. Documenta
qué se cableó, dónde, y qué queda diferido (y por qué). F-INT no reescribe lógica
de otras fases: cuando un wiring tocó un glob ajeno, se hizo con el rol de owner
de esa fase (modo single-maintainer) y se registra aquí.

## Gates transversales cableados (mitad autónoma, sin sandbox)

| Gate                                   | Origen                                   | Punto de inserción                                                           | Comportamiento                                                                                                        |
| -------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Consentimiento RGPD imagen             | F14 `assertConsent('IMAGE_PROCESSING')`  | `orchestrator.ts` `handleIngest` (antes de visión) y `api/iterations` POST   | Sin consentimiento → no se trata la imagen ni se gasta crédito                                                        |
| Aceptación de ToS                      | F19 `assertTosAccepted`                  | `orchestrator.ts` `handleDeliver` (antes de generar) y `api/iterations` POST | Sin ToS vigente aceptado → no se genera entregable                                                                    |
| Jurisdicción de modelos                | F14 `enforceModelJurisdiction`           | `ai/index.ts` `chat`/`chatStream` sobre el modelo resuelto                   | Solo aplica si hay `AI_MODEL_JURISDICTION_ALLOWLIST` configurada (fail-closed cuando se configura; desactivado si no) |
| Consentimiento de cookies (afiliación) | F19 `cookieCategoryAllowed('affiliate')` | `marketplace/server/affiliate-tracking.ts`                                   | Usuario identificado sin consentir → no se registra el evento; clic anónimo → métrica sin PII                         |

`userId` se propaga ahora a través de `getAgent(organizationId, userId)` →
`AgentDeps.userId`, resuelto desde `requireOrgContext()` en la Server Action.

## DebitService real verificado

`createDebitService` (F8) sobre `CreditHold` se ejerce en `cost-to-credit.test.ts`
con Postgres real: el mapeo `OperationCost` → créditos (provider USD y tokens) y el
saldo cuadran tras hold/settle/revert. No se usa el stub de F0.

## Desajustes de contrato detectados

- **`DebitService.settle`**: el contrato (F0, `src/lib/contracts/debit-service.ts`)
  declara `settle(hold, actualCost)` con el coste real medido como 2º argumento,
  pero la implementación real (F8, `debit-service-impl.ts`) define `settle(h)` y
  **ignora** el coste real (no concilia hold estimado vs coste real). Funciona —
  el hold ya descontó el estimado— pero el ajuste fino estimado→real queda sin
  implementar. **Owner a notificar:** F8. Severidad: baja (no rompe; pierde la
  reconciliación de pricing que el propio comentario del contrato anuncia).

## Diferido a la mitad con sandbox (necesita dev-keys)

Estas partes del plan F-INT **no** corren en CI ni sin claves reales; quedan como
job nightly/staging pendiente de los secrets de sandbox:

- **`full-flow-vivo`**: ingesta→cualificación→entrega→feedback contra OpenRouter
  dev-key + sandbox de imagen + Polar sandbox. Requiere `OPENROUTER_API_KEY` real
  y claves de proveedor de imagen.
- **`stream-event-contract`** y **`inpaint-mask-contract`** contra el adaptador
  real (no el doble determinista): validan la forma real de `AgentStreamEvent` y de
  la máscara `InpaintRequest` que el proveedor acepta. Sin sandbox, los contratos
  se ejercitan a nivel de tipos/dobles, no contra el proveedor vivo.
- **Job de sandbox** (schedule, secrets, separación del PR-gate): coordinar con F11.

## PII-scrub (blur de caras) — punto de inserción pendiente

`scrubImageForAi` (F14) necesita el **Buffer original** de la imagen. En el
orquestador, las imágenes ya llegan como `MessagePart` (base64/url), no como
Buffer crudo, por lo que el scrub debe insertarse **aguas arriba**, en el punto de
subida/recepción del fichero (antes de construir las `MessagePart`). Ese punto de
subida del flujo de usuario aún no existe como tal; cuando se construya, debe
llamar a `scrubImageForAi` antes de pasar la imagen al agente. Documentado aquí
para no insertar un scrub que no recibiría el Buffer.
