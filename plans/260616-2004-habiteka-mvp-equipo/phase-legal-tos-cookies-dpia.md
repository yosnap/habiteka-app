# F19 — Legal: ToS/EULA, consentimiento de cookies & DPIA (bloqueante UE)

**Context Links:** [plan.md](plan.md) · RGPD/privacidad: [phase-14](phase-14-rgpd-privacidad.md) · UX/disclaimer: [phase-01](phase-01-ux-design-system.md) · marketplace/afiliación: [phase-10](phase-10-addon-marketplace.md) · analítica: [phase-18](phase-18-admin-analitica-facturacion-logs.md)

## Overview
- **Rol primario:** ARQ/Legal + BE + FE
- **Prioridad:** P1 (**bloqueante de lanzamiento UE**, junto a F14)
- **Estado:** ✅ Hecho (`docs/legal/tos/**`: ToS/EULA + DPIA; `src/server/legal/**`: tos-acceptance + cookie-consent + actions; `src/components/legal/**`: banner cookies + gate ToS + cookie-gate; modelos `TosAcceptance`/`CookieConsent`; banner montado en layout; página `/legal/terminos`; 9 tests). El cableado de tracking F10/F18 → consulta de consentimiento va en F-INT.
- **Depende de:** F14 (RGPD: política de privacidad, RAT, base legal; F19 complementa sin solapar)
- **Paralela con:** F14 (M4 cumplimiento)
- **Descripción:** Cubre los **huecos legales que F14 (RGPD) NO cubre**, identificados por el red team legal: (a) **Términos de Servicio/EULA** con limitación de responsabilidad, exclusión de garantía sobre la validez técnica/estructural del output y validación profesional como condición contractual; (b) **banner/gestión de consentimiento de cookies** (ePrivacy) para tracking de afiliación (F10) y analítica (F18); (c) **DPIA art. 35** (evaluación de impacto). F14 hace RAT art. 30; F19 hace la DPIA art. 35, distinta y exigible aquí.

## Key Insights
- **Disclaimer UX ≠ limitación de responsabilidad.** Si un usuario ejecuta una reforma sobre un plano con un muro de carga mal detectado → daño físico. F1 solo diseña la UX del disclaimer; **nadie redacta el instrumento jurídico**. Un disclaimer en barra inferior no exonera (Dir. 85/374 producto defectuoso, Dir. responsabilidad IA, cláusulas abusivas B2C nulas Dir. 93/13). Hace falta **ToS/EULA real** con limitación de responsabilidad, exclusión de garantía técnica/estructural, **validación profesional como CONDICIÓN CONTRACTUAL** e indemnización.
- **Cookies sin banner = infracción ePrivacy.** F10 (afiliación/redirect) deja cookies de terceros y F18 hace analítica; sin banner de consentimiento previo, las cookies no esenciales se instalan ilegalmente. ePrivacy exige **consentimiento previo** (opt-in), no opt-out.
- **DPIA art. 35 probablemente obligatoria:** tratamiento a escala de imágenes de domicilio + perfilado → la DPIA es casi segura. F14 cubre el RAT (art. 30) pero **no** la DPIA (art. 35) — son instrumentos distintos.
- **F19 NO solapa con F14:** F14 posee `docs/legal/*.md` (privacy raíz, no recursivo) + `src/server/privacy/**`; F19 usa la **subcarpeta `docs/legal/tos/**`** + `src/components/legal/**` (banner) + `src/server/legal/**` (gating de aceptación). Globs disjuntos.

## Requirements
**Funcionales**
- **ToS/EULA** publicado: limitación de responsabilidad, exclusión de garantía sobre validez técnica/estructural del output, validación profesional como **condición contractual**, cláusula de indemnización. Revisión por abogado de consumo.
- **Aceptación de ToS registrada** (versión + timestamp) **antes de generar** cualquier entregable; sin aceptación → generación bloqueada.
- **Banner de cookies** (FE) que **bloquea cookies no esenciales hasta el consentimiento** explícito (opt-in granular: necesarias / analítica F18 / afiliación F10).
- **Registro del consentimiento de cookies** (categorías aceptadas, versión, ts) y respeto del mismo por el tracking de F10/F18.
- **DPIA art. 35** documentada (evaluación de impacto: riesgos, medidas, residual).

**No funcionales**
- Cookies no esenciales NO se instalan hasta consentimiento (verificable en test).
- Versionado de ToS para trazar qué versión aceptó cada usuario (coherente con consentimiento de F14).
- Archivos ≤200 líneas; tipos desde `@/lib/contracts`.

## Architecture
```
docs/legal/tos/
  terms-of-service.md        # ToS/EULA: limitación responsabilidad, exclusión garantía, validación profesional, indemnización
  dpia.md                    # DPIA art. 35 (evaluación de impacto)
src/components/legal/
  cookie-consent-banner.tsx  # banner opt-in granular (necesarias/analítica/afiliación)
  tos-acceptance-gate.tsx    # UI de aceptación de ToS antes de generar
src/server/legal/
  tos-acceptance-service.ts  # registrar/consultar aceptación de ToS (versión, ts); gate de generación
  cookie-consent-service.ts  # registrar/consultar consentimiento de cookies (categorías, versión, ts)
```
**Data flow (ToS):** alta/primer uso → `tos-acceptance-gate` → usuario acepta → `tos-acceptance-service` registra versión+ts → desbloquea generación (sin aceptación → bloqueada). **Data flow (cookies):** primera visita → `cookie-consent-banner` (todo no esencial **bloqueado** por defecto) → usuario elige categorías → `cookie-consent-service` registra → F10/F18 consultan antes de instalar/disparar tracking. **Data flow (DPIA):** documento estático revisado antes de lanzamiento UE.

## Related Code Files
**A crear (owner ARQ/Legal + BE + FE):**
- `docs/legal/tos/terms-of-service.md`, `docs/legal/tos/dpia.md`.
- `src/components/legal/cookie-consent-banner.tsx`, `src/components/legal/tos-acceptance-gate.tsx`.
- `src/server/legal/tos-acceptance-service.ts`, `src/server/legal/cookie-consent-service.ts`.
**Owner globs:** `docs/legal/tos/**`, `src/components/legal/**`, `src/server/legal/**`.
**Lee/usa (no edita):** `src/lib/contracts/**` (F0); modelos/scoping de F2 (`withOrg`); coordina con F14 (consentimiento de privacidad) sin duplicar; F10/F18 consultan `cookie-consent-service` antes de tracking.
**NO tocar:** `docs/legal/*.md` raíz (privacy, DPA, RAT, retención = F14); `src/server/privacy/**` (F14); `prisma/**` salvo campos de aceptación/consentimiento aditivos coordinados con F2.

## Implementation Steps
1. Redactar `terms-of-service.md` (limitación responsabilidad, exclusión garantía técnica/estructural, validación profesional como condición, indemnización) → revisión por abogado de consumo.
2. `tos-acceptance-service.ts` + `tos-acceptance-gate.tsx`: registrar aceptación (versión+ts); **bloquear generación** sin aceptación. Coordinar con F2 campo de aceptación (aditivo).
3. `cookie-consent-banner.tsx` + `cookie-consent-service.ts`: opt-in granular; **bloquear cookies no esenciales** hasta consentimiento; registrar categorías.
4. Cablear F10 (afiliación) y F18 (analítica) para que **consulten** `cookie-consent-service` antes de instalar cookies/disparar tracking (coordinación, sin que F19 edite sus globs).
5. Redactar `dpia.md` (DPIA art. 35): riesgos del tratamiento, medidas, riesgo residual.
6. Tests: ver sección **TDD / Pruebas primero**.

## Todo List
- [x] `terms-of-service.md` (limitación resp., exclusión garantía, validación profesional, indemnización) — base, requiere revisión legal
- [x] `tos-acceptance-service` + `tos-acceptance-gate` (aceptación antes de generar) + página pública `/legal/terminos`
- [x] `cookie-consent-banner` + `cookie-consent-service` (opt-in granular, bloqueo previo) + `cookie-gate` (lógica pura cliente)
- [ ] Cableado F10/F18 → consultan `cookieCategoryAllowed` antes de tracking (servicio listo; el wiring a sus globs va en F-INT)
- [x] `dpia.md` (DPIA art. 35)
- [x] Tests: gating de cookies (fail-closed/granular) + ToS aceptado antes de generar — verdes (9)

## Success Criteria
- ToS/EULA publicado y revisado legalmente; **generación bloqueada** sin aceptación registrada (versión+ts).
- Banner de cookies **bloquea toda cookie no esencial hasta el consentimiento**; F10/F18 respetan las categorías.
- DPIA art. 35 documentada antes del lanzamiento UE.
- Globs disjuntos verificados: F19 (`docs/legal/tos/**`, `src/components/legal/**`, `src/server/legal/**`) no solapa con F14 (`docs/legal/*.md` raíz no recursivo, `src/server/privacy/**`).

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Daño físico por reforma sobre output erróneo sin ToS que limite responsabilidad | Media | Crítico | ToS/EULA con limitación de responsabilidad + validación profesional como condición contractual + indemnización; revisión por abogado |
| Cookies de terceros (F10/F18) sin consentimiento → infracción ePrivacy | Alta | Alto | Banner opt-in que bloquea no esenciales hasta consentir; F10/F18 consultan el servicio antes de instalar |
| Lanzamiento UE sin DPIA art. 35 exigible | Media | Alto | `dpia.md` documentada antes de M4/lanzamiento |
| Solape de ficheros con F14 | Baja | Medio | Subcarpeta `tos/` + globs disjuntos `src/{components,server}/legal/**`; F14 mantiene privacy en sus globs |
| ToS B2C con cláusulas abusivas nulas (Dir. 93/13) | Media | Alto | Revisión por abogado de consumo; redacción acorde a derecho de consumo UE |

## Security Considerations
- Aceptación de ToS y consentimiento de cookies autenticados y scoped (`withOrg`, F2): cada registro ligado a su titular.
- Versionado de ToS y de categorías de cookies para trazabilidad (qué versión aceptó cada usuario, cuándo).
- El servicio de consentimiento es la **única fuente de verdad** para F10/F18: ningún tracking se dispara sin consultarlo.

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor), integration/Vitest:
- **Banner bloquea cookies no esenciales hasta consentir:** sin consentimiento, ninguna cookie de analítica (F18) ni de afiliación (F10) se instala; tras opt-in de una categoría, solo esa se habilita. Rojo si una cookie no esencial se instala antes del consentimiento.
- **ToS aceptado antes de generar:** solicitud de generación sin aceptación de ToS registrada → bloqueada; con aceptación (versión+ts) → permitida. Verde con `tos-acceptance-service`.
- **Mock:** se mockea el almacén de cookies del navegador para verificar el bloqueo; NO se mockea la lógica de gating de aceptación ni la de consentimiento (es lo que se prueba). Cero red externa.

## Next Steps
- Coordinar con F2 los campos aditivos de aceptación de ToS y categorías de cookies.
- Coordinar con F10/F18 el punto de consulta del consentimiento antes de cualquier tracking.
- Bloqueante de lanzamiento UE junto a F14: ambas deben cerrarse antes de exponer el servicio a usuarios de la UE (M4).
