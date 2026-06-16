# F14 — RGPD & Privacidad (ARQ/Legal + Backend)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) · datos/auth: [phase-02](phase-02-be-datos-auth.md) · adaptadores IA: [phase-03](phase-03-ia-adaptadores.md)

## Overview
- **Rol primario:** ARQ/Legal + Backend
- **Prioridad:** P1 (**bloqueante para lanzar en la UE**)
- **Estado:** Planificado
- **Depende de:** F2 (modelo de datos, auth, scoping; donde viven los datos personales)
- **Paralela con:** F8, F9, F10, F13 (M3/M4)
- **Descripción:** Cumplimiento RGPD/privacidad. Las **fotos de viviendas son dato personal** (pueden revelar domicilio, situación patrimonial, e incluso personas). Cubre base legal y consentimiento, DPA con subencargados (OpenRouter y proveedor de imagen), política de retención/borrado, derecho de supresión, minimización/anonimización y registro de actividades de tratamiento (RAT).

## Key Insights
- **Fotos de viviendas = dato personal** y potencialmente sensible (ubicación, patrimonio) → tratamiento sujeto a RGPD; no es "solo una imagen".
- **Subencargados de tratamiento:** OpenRouter (chat/visión) y el proveedor de imagen procesan datos del usuario → requieren **DPA** (art. 28) y figurar en el RAT y en la política de privacidad.
- **Supresión: garantizado (propio) vs best-effort (subencargados).** Un dato ya enviado a OpenRouter (rutea a N proveedores con retención propia) o al proveedor de imagen **no se puede "des-enviar"**. Prometer "cero datos tras supresión" sería declaración falsa al interesado. La promesa debe separar **borrado garantizado en sistemas propios** (DB + object storage) de **best-effort en subencargados** (según contrato/retención de cada uno) — informarlo así en la política y al interesado.
- **Transferencia internacional NO determinista:** OpenRouter elige proveedor (USA/varios) **por request** vía `extra_body.models`; los SCCs (art. 44+) exigen destino conocido, aquí es variable. Mitigación: **allowlist de modelos por jurisdicción con SCCs**, o despliegues UE/zero-retention, + **opt-out de entrenamiento por contrato**; **informar la transferencia (art. 13.1.f) en la captura** de la imagen.
- **Minimización (art. 5):** enviar a la IA solo lo necesario; strip de EXIF/geolocalización **y detección/blurring de personas/caras/matrículas** antes de procesar (amplía el sanitizer de F3 más allá de EXIF); no retener prompts con datos personales más de lo necesario.
- **Terceros y menores en fotos:** personas, matrículas, vecinos visibles → **sin base legal para no-usuarios**; riesgo art. 8 (menores). Definir base legal para terceros + medida técnica (blurring) antes de enviar a IA.
- **Derecho de supresión (art. 17):** borrado real y en cascada en sistemas propios (proyectos, imágenes, deliverables, mensajes, assets) — no solo soft-delete; best-effort + solicitud de borrado a subencargados.
- **Base legal:** consentimiento explícito para el tratamiento de la imagen + ejecución de contrato para el servicio; registrar el consentimiento (qué, cuándo, versión de política).
- **F9 votación = roles responsable/encargado:** la captación de datos de vecinos a escala exige definir responsable/encargado + **contrato art. 28 con administradores de finca** + control de edad. (Detalle de implementación en F9; F14 fija el marco.)
- **Append-only vs borrado:** el `CreditLedger` es auditoría (no se borra) pero **no debe contener datos personales** — solo refs/ids; el borrado de PII recae sobre proyectos/imágenes/mensajes.
- **No solapa con F19:** F14 = privacidad (privacy-policy, DPA, RAT, retención, supresión, minimización) en `docs/legal/*.md` (raíz, no recursivo) + `src/server/privacy/**`. **ToS/EULA, banner de cookies y DPIA art. 35 son F19** (`docs/legal/tos/**`, `src/{components,server}/legal/**`).

## Requirements
**Funcionales**
- Captura y registro de **consentimiento** (versión de política, timestamp) en el alta/subida de imagen, **informando la transferencia internacional** (art. 13.1.f) en la captura.
- **Política de privacidad** y **DPA** publicados; lista de subencargados (OpenRouter, proveedor imagen). La política **separa supresión garantizada (propio) de best-effort (subencargados)**.
- **Allowlist de modelos por jurisdicción con SCCs** (o despliegue UE/zero-retention) + **opt-out de entrenamiento por contrato** — coordinado con el routing de F3 (que es no determinista por defecto).
- **Endpoint/flujo de supresión**: borrado en cascada **garantizado en sistemas propios** (proyectos, imágenes, deliverables, mensajes, assets) + **solicitud best-effort** a subencargados según contrato.
- **Política de retención**: TTL por tipo de dato (imágenes de origen, assets generados, logs); job de purga.
- **Minimización**: strip EXIF/geo **+ detección/blurring de personas/caras/matrículas** antes de enviar a IA (amplía el sanitizer de F3); base legal para terceros/menores; no loggear contenido personal de prompts.
- **RAT** (registro de actividades de tratamiento, art. 30) documentado. *(DPIA art. 35 → F19.)*
- **Exportación de datos** (art. 20, portabilidad) — al menos export básico de proyectos/imágenes del usuario.

**No funcionales**
- Borrado verificable (sin huérfanos en DB ni en object storage).
- Secrets/PII nunca en logs; logs solo metadatos.
- Archivos ≤200 líneas; tipos desde `@/lib/contracts`.

## Architecture
```
docs/legal/
  privacy-policy.md          # política de privacidad (B2C/B2B, UE)
  dpa.md                     # Data Processing Agreement + lista de subencargados
  data-retention.md          # TTL por tipo de dato + criterios de purga
  records-of-processing.md   # RAT (art. 30)
src/server/privacy/
  consent-service.ts         # registrar/consultar consentimiento (versión política, ts)
  deletion-service.ts        # supresión en cascada (DB + object storage + subencargados)
  retention-job.ts           # purga por TTL (imágenes origen, assets, logs)
  data-export.ts             # export de datos del usuario (portabilidad)
  pii-scrub.ts               # strip EXIF/geo + blurring de personas/caras/matrículas antes de IA (coord. con F3)
  jurisdiction-allowlist.ts  # allowlist de modelos por jurisdicción con SCCs (consultada por el routing de F3)
```
**Data flow (consentimiento):** alta/subida → informar transferencia (art. 13.1.f) → `consent-service` registra versión+ts → permite tratamiento. **Data flow (supresión):** solicitud → `deletion-service` borra en cascada en sistemas propios (proyectos→imágenes→deliverables→mensajes→assets), confirma cero huérfanos → **solicitud best-effort** a subencargados (no se promete borrado total). **Data flow (minimización):** imagen → `pii-scrub` (EXIF/geo **+ blurring de personas/caras/matrículas**) → adaptador F3 → IA. **Data flow (transferencia):** routing F3 consulta `jurisdiction-allowlist` → solo modelos con SCCs/UE/zero-retention. **Data flow (retención):** `retention-job` (cron) → purga datos vencidos.

## Related Code Files
**A crear (owner ARQ/Legal + BE):**
- `docs/legal/privacy-policy.md`, `dpa.md`, `data-retention.md`, `records-of-processing.md`.
- `src/server/privacy/consent-service.ts`, `deletion-service.ts`, `retention-job.ts`, `data-export.ts`, `pii-scrub.ts`, `jurisdiction-allowlist.ts`.
**Owner globs:** `docs/legal/*.md` (privacy raíz, **NO recursivo**; `docs/legal/tos/**` es F19), `src/server/privacy/**`.
**Lee/usa (no edita):** `src/lib/contracts/**` (F0); modelos/scoping de F2 (`withOrg`); el sanitizer de F3 (`pii-scrub` coordina formato, no duplica); el routing de F3 **consulta** `jurisdiction-allowlist` vía interfaz.
**NO tocar:** `prisma/**` salvo coordinación con F2 (campos de consentimiento/retención aditivos vía F2); `src/server/ai/**` (F3); `src/server/billing/**` (F8); `src/server/agent/**` (F5/F7); `docs/legal/tos/**` + `src/{components,server}/legal/**` (F19). Object storage: definir bucket/lifecycle con F11.

## Implementation Steps
1. Inventario de PII: enumerar dónde vive el dato personal (imágenes, mensajes, deliverables, assets, consentimiento) → base del RAT.
2. `docs/legal/`: redactar privacy-policy (con distinción supresión propio/best-effort + transferencia internacional), DPA (subencargados OpenRouter + proveedor imagen), data-retention, RAT. Revisión legal.
3. Coordinar con F2 campos de consentimiento (versión política, ts) y TTL (aditivos al schema, F2 los aplica).
4. `pii-scrub.ts`: strip EXIF/geo **+ blurring de personas/caras/matrículas** antes de IA; integrar con el sanitizer de F3 (formato común, sin duplicar).
5. `jurisdiction-allowlist.ts`: allowlist de modelos por jurisdicción con SCCs; coordinar con F3 que el routing la consulte (no determinista por defecto).
6. `consent-service.ts`: registrar/consultar consentimiento en alta/subida, informando la transferencia (art. 13.1.f).
7. `deletion-service.ts`: borrado en cascada DB + object storage (**garantizado, sin huérfanos**) + **solicitud best-effort** a subencargados.
8. `retention-job.ts`: purga por TTL (cron/scheduled; coordinar disparo con F11).
9. `data-export.ts`: export básico de datos del usuario (portabilidad).
10. Tests: ver sección **TDD / Pruebas primero** (escribir antes de cada servicio).

## Todo List
- [ ] Inventario de PII + RAT (`records-of-processing.md`)
- [ ] Política de privacidad + DPA (subencargados OpenRouter/imagen)
- [ ] Política de retención + TTL por tipo de dato
- [ ] Distinción supresión garantizada (propio) vs best-effort (subencargados) en política
- [ ] `jurisdiction-allowlist` (modelos por jurisdicción con SCCs, coord. routing F3)
- [ ] `consent-service` (registro de consentimiento + info transferencia art. 13.1.f)
- [ ] `pii-scrub` (strip EXIF/geo + blurring personas/caras/matrículas, coord. F3)
- [ ] `deletion-service` (cascada propio sin huérfanos + best-effort subencargados)
- [ ] `retention-job` (purga por TTL, disparo coord. F11)
- [ ] `data-export` (portabilidad)
- [ ] Marco F9 votación: roles responsable/encargado + contrato art. 28 + control de edad (detalle en F9)
- [ ] Tests de consentimiento/supresión/minimización/retención — verdes

## Success Criteria
- Subida de imagen sin consentimiento registrado → bloqueada; la captura **informa la transferencia internacional** (art. 13.1.f).
- Solicitud de supresión deja **cero** datos personales del usuario **en sistemas propios** (DB + object storage); a subencargados se envía **solicitud best-effort** (no se promete borrado total).
- EXIF/geolocalización removidos **y personas/caras/matrículas difuminadas** antes de enviar la imagen a la IA.
- El routing solo usa **modelos de la allowlist por jurisdicción con SCCs** (o UE/zero-retention).
- `data-retention` aplicado por `retention-job`; datos vencidos purgados.
- `docs/legal/` (privacidad con distinción propio/best-effort, DPA, RAT, retención) publicados y revisados legalmente.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Foto de vivienda tratada sin base legal/consentimiento | Media | Crítico | `consent-service` obligatorio antes del tratamiento; base legal documentada |
| Promesa de "borrado total" incumplible (dato ya en subencargado) | Alta | Crítico | Política separa supresión garantizada (propio) vs best-effort (subencargados); no se declara cero datos en subencargados |
| Transferencia internacional no determinista (OpenRouter rutea a USA/varios) | Alta | Crítico | `jurisdiction-allowlist` con SCCs (o UE/zero-retention) + opt-out de entrenamiento; informar transferencia (art. 13.1.f) |
| Terceros/menores en fotos sin base legal (art. 8) | Media | Alto | `pii-scrub` con blurring de personas/caras/matrículas; base legal de terceros documentada |
| Subencargado (OpenRouter/imagen) sin DPA | Media | Crítico | DPA firmado + RAT; verificar cláusulas de transferencia (art. 44+) |
| Borrado incompleto (huérfanos en DB u object storage propios) | Media | Alto | Supresión en cascada verificable; tests de cero huérfanos en sistemas propios |
| EXIF/geo/personas filtrados a la IA (sobre-exposición de PII) | Media | Alto | `pii-scrub` strip EXIF/geo + blurring antes de IA, coordinado con sanitizer F3 |
| PII en logs / ledger | Media | Alto | Logs solo metadatos; `CreditLedger` con refs/ids, nunca PII |
| Retención indefinida sin base | Media | Medio | `data-retention` con TTL + `retention-job` de purga |

## Security Considerations
- PII nunca en logs ni en el ledger (solo refs/ids); cifrado en tránsito y en reposo del object storage.
- Supresión y export autenticados y scoped (`withOrg`, F2): solo el titular (o admin de su org) opera sobre sus datos.
- Minimización antes de IA: solo lo necesario, sin EXIF/geo.
- Acceso a `docs/legal/` versionado; cambios de política versionados para trazar consentimiento.

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor), integration/Vitest contra DB de test:
- **Borrado en cascada (derecho de supresión)**: tras la supresión, cero datos personales del usuario en DB y object storage **propios** (proyectos→imágenes→deliverables→mensajes→assets); sin huérfanos. La solicitud a subencargados se registra (best-effort), no se asevera borrado total. Rojo sin cascada completa propia.
- **Consentimiento requerido antes de subir foto**: subida sin consentimiento registrado (versión política + ts) → bloqueada; con consentimiento → permitida. Verde con `consent-service`.
- **Minimización EXIF/geo + blurring**: `pii-scrub` elimina EXIF/geolocalización **y difumina personas/caras/matrículas** antes de pasar la imagen al adaptador de IA. Rojo si el EXIF persiste o una cara detectable queda sin difuminar.
- **Allowlist de jurisdicción**: el routing rechaza un modelo fuera de `jurisdiction-allowlist`; solo modelos con SCCs/UE pasan. Rojo si un modelo no permitido se selecciona.
- **Retención por TTL**: `retention-job` purga datos vencidos y conserva los vigentes.
- **Mock:** se mockea el object storage (verificar borrado/lifecycle) y la propagación a subencargados; el reloj para TTL. NO se mockea la lógica de cascada ni `pii-scrub` (es lo que se prueba). Cero red a IA real.

## Next Steps
- Coordinar con F2 los campos aditivos de consentimiento/retención, con F3 que el routing consulte `jurisdiction-allowlist`, y con F11 el lifecycle del object storage y el cron de purga.
- **F19** cubre lo que F14 no: ToS/EULA, banner de cookies (ePrivacy) y DPIA art. 35. F14 y F19 son **conjuntamente** bloqueantes de lanzamiento UE.
- Bloqueante de lanzamiento UE: debe cerrarse antes de exponer el servicio a usuarios de la UE (M4 hardening).
