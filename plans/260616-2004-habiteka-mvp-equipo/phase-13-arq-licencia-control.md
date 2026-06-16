# F13 — Licencia fair-code & Control técnico de uso (ARQ / Tech Lead)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) (§3 principio de licencia, §8 negocio/licencia) · contratos/adaptadores: [phase-00](phase-00-arq-setup-contratos.md) · adaptadores IA: [phase-03](phase-03-ia-adaptadores.md) · billing/plan: [phase-08](phase-08-be-creditos-pagos.md)

## Overview
- **Rol primario:** ARQ / Tech Lead
- **Prioridad:** P1 (modelo de negocio fair-code; protege la explotación comercial)
- **Estado:** Planificado
- **Depende de:** F3 (adaptadores IA: punto donde se intercepta la llamada a OpenRouter), F8 (plan/estado de licencia por usuario/organización).
- **Paralela con:** — (cierre del MVP; M3).
- **Descripción:** El control es **LEGAL + OPERATIVO**, no una imposibilidad técnica: (1) **Sustainable Use License** (fair-code estilo n8n) — `LICENSE` + política (`docs/licensing.md`) define qué uso comercial está restringido; (2) la **barrera real es operativa**: el servicio oficial de Habiteka es quien **posee la API key de OpenRouter**, así que el uso del agente a escala pasa por la infra oficial. El JWT de licencia es un gate **dentro del servicio oficial** (UX/billing/scope), NO una protección anti-fork. Un fork **puede** borrar el guard y usar su propia key de OpenRouter — eso lo cubre la **licencia**, no el código.
- **Alcance MVP vs post-MVP (segmento B2C primario):** en el MVP entra **solo la parte técnica/legal** — `LICENSE` fair-code (SUL), `docs/licensing.md`, y el **control operativo** (license-guard + JWT de scope ante el adaptador F3). El **onboarding comercial B2B y el flujo de venta/contratación de licencia comercial son POST-MVP** (el segmento primario del MVP es B2C). El MVP **deja la capacidad lista** (el JWT codifica `scope` comercial/interno desde el plan de F8 y el modelo es multi-tenant por `organizationId`), pero **no construye** la UX de alta comercial, el flujo de cobro de licencia B2B ni el portal de gestión de licencias.

## Key Insights
- **Fair-code = fuente abierta + restricción comercial:** Sustainable Use License (modelo n8n): self-host interno permitido, explotación comercial obliga a hosting oficial / licencia (§8). No es OSI-open-source; el `LICENSE` lo deja explícito para evitar ambigüedad legal.
- **El control NO es ofuscación ni "imposibilidad técnica en un fork":** un fork con su propia key de OpenRouter puede borrar el guard y operar. La protección real es: (a) **legal** (la SUL restringe explotación comercial) y (b) **operativa** (el servicio oficial posee la key/infra que la mayoría de usuarios no querrá replicar). No vender el JWT como barrera infranqueable — es engañarse.
- **JWT firmado como gate del servicio oficial (no anti-fork):** dentro del despliegue oficial, antes de consumir IA, el adaptador (F3) exige un **token de licencia firmado** que codifica plan/scope (de F8). Sirve para **UX/billing/scope** y para que self-host **interno** declare su licencia — no para impedir un fork malicioso (eso es jurisdicción de la licencia). Falta/expira/firma inválida → rechazo, dentro del servicio oficial.
- **Punto de intercepción único = el adaptador F3:** centralizar el gate en `ChatVisionAdapter`/`ImageAdapter` (o un wrapper que los envuelve) garantiza que **ninguna ruta** a IA lo salte (DRY). No esparcir checks por F5/F7.
- **Key nunca al cliente (invariante ya en arquitectura):** F13 no introduce exposición; refuerza que `OPENROUTER_API_KEY` y la clave privada de firma son server-only. El cliente nunca ve token de licencia con valor reutilizable fuera de sesión.
- **Plan B2B de F8 alimenta la licencia:** el tipo de uso/plan que F8 registra determina si el token de licencia se emite y con qué scope (comercial vs interno). F13 consume ese estado; no reimplementa billing.
- **Evitar lock-out propio (cache + grace period):** el despliegue oficial debe poder emitir/rotar la clave de firma sin caída. La verificación cachea el último resultado válido y aplica un **grace period** ante fallo transitorio de firma/servicio de claves → no se corta el servicio propio por un glitch. Solo tras agotar el grace se aplica fail-closed, con mensaje accionable.

## Requirements
**Funcionales**
- `LICENSE`: texto Sustainable Use License (fair-code) en la raíz del repo.
- `docs/licensing.md`: política de uso (interno permitido / comercial restringido), FAQ, cómo obtener licencia comercial.
- Emisión de **JWT de licencia** firmado por el servidor central (clave privada server-only), con `exp` corto y claims de plan/scope (de F8).
- **Verificación previa a IA (dentro del servicio oficial):** guard que valida el token (firma + `exp` + scope) antes de que el adaptador F3 consuma OpenRouter/imagen.
- **Cache de verificación + grace period:** cachear el último resultado válido; ante fallo transitorio del servicio de claves/firma, conceder grace antes de cortar (evita lock-out propio).
- Rechazo accionable: tras grace agotado y sin token válido → error tipado `LicenseError` con mensaje que indica hosting oficial / licencia.
- Rotación de clave de firma soportada (key id / `kid` en el JWT).

**No funcionales**
- Clave privada de firma y `OPENROUTER_API_KEY` exclusivamente server-side; nunca en cliente/RSC payload.
- Verificación rápida (firma asimétrica, sin red por request salvo refresh) y fail-closed para IA.
- Archivos ≤200 líneas; tipos desde `@/lib/contracts`.

## Architecture
```
LICENSE                               # Sustainable Use License (fair-code)
docs/licensing.md                     # política de uso + FAQ comercial
src/lib/licensing/
  license-claims.ts                   # tipos: LicenseClaims { plan, scope, exp, kid }
  sign-license.ts                     # emite JWT firmado (clave privada server-only)
  verify-license.ts                   # verifica firma + exp + scope (clave pública/kid)
  license-guard.ts                    # gate previo a IA: token válido (con cache+grace) o LicenseError
  verification-cache.ts               # cache del último resultado válido + grace period (anti lock-out)
  keys.ts                             # carga clave privada/pública por `kid` (server-only)
  errors.ts                           # LicenseError (missing|expired|invalid_signature|out_of_scope)
```
**Punto de integración (sin solape):** `license-guard` se **invoca desde** el wrapper del adaptador de F3 (F3 importa y llama al guard antes de `chat`/`generate`); F13 **provee** el guard, F3 lo **consume**. El estado de plan/scope lo **provee F8** (`gating`/`Subscription`) y `sign-license` lo codifica.

**Data flow (emisión):** sesión autenticada (F2) + plan/scope (F8) → `sign-license` firma JWT (`kid`, `exp` corto) con clave privada del servidor central → token entregado al runtime server-side (no persistido en cliente con valor reutilizable). **Data flow (consumo IA):** llamada a IA → adaptador F3 → `license-guard.verify` (`verify-license`: firma + `exp` + scope) → si OK, F3 usa `OPENROUTER_API_KEY` server-only y llama a OpenRouter; si KO → `LicenseError`, **no** se consume IA. **Fork self-host:** el guard de un fork puede ser eliminado y el fork puede usar su propia key de OpenRouter → el agente funcionaría. Eso NO lo impide el código; lo cubre la **licencia** (uso comercial restringido). La barrera práctica es operativa (no querer montar/pagar la infra y key propias).

## Related Code Files
**A crear (owner ARQ/F13):**
- `LICENSE` — texto de la licencia fair-code.
- `docs/licensing.md` — política de uso y FAQ.
- `src/lib/licensing/license-claims.ts`, `sign-license.ts`, `verify-license.ts`, `license-guard.ts`, `verification-cache.ts`, `keys.ts`, `errors.ts`.
**Owner globs:** `LICENSE`, `src/lib/licensing/**`, `docs/licensing.md`.
**Lee/usa (no edita):** `src/lib/contracts/**` (F0); estado de plan/scope de F8 (`Subscription`/`gating` — importa, no edita `src/server/billing/**`); el adaptador de F3 **importa** `license-guard` (la edición del wrapper de F3 es de F3, no de F13).
**NO tocar:** `src/server/ai/**` y `src/server/agent/**` (F3/F5 — F13 expone el guard, F3 lo cablea); `src/server/billing/**` (F8); `prisma/**` (F2); cualquier glob de otras fases. `.env.example` se actualiza coordinando con F0/F11 (añadir `LICENSE_SIGNING_KEY`/`kid`), sin poseerlo.

## Implementation Steps
1. `LICENSE`: redactar Sustainable Use License (fair-code, base n8n SUL): permiso self-host/interno, restricción de explotación comercial, atribución; revisar con asesoría legal.
2. `docs/licensing.md`: política, qué es uso comercial, cómo obtener licencia oficial, FAQ; enlazar desde README.
3. `license-claims.ts`: tipar `LicenseClaims` (`plan`, `scope`, `exp`, `kid`).
4. `keys.ts`: cargar clave privada (firma) y pública (verificación) por `kid` desde secrets server-only; soportar rotación.
5. `sign-license.ts`: emitir JWT asimétrico (`exp` corto) con claims de plan/scope provistos por F8.
6. `verify-license.ts`: verificar firma (por `kid`), `exp` y `scope`; devolver claims o `LicenseError`.
7. `verification-cache.ts`: cachear último resultado válido + grace period; `license-guard.ts`: función que F3 invoca antes de consumir IA; valida vía cache/grace; tras grace agotado lanza `LicenseError(missing|expired|invalid_signature|out_of_scope)`.
8. Coordinar con F3: el wrapper del adaptador llama a `license-guard` antes de `chat`/`generate` (F3 edita su propio módulo).
9. Coordinar con F0/F11: `.env.example` + secrets `LICENSE_SIGNING_KEY`/`kid` server-only.
10. Tests: ver sección **TDD / Pruebas primero** (escribir antes del guard/verify).

## Todo List
- [ ] `LICENSE` Sustainable Use License (fair-code) en raíz
- [ ] `docs/licensing.md` política + FAQ comercial
- [ ] `LicenseClaims` tipados
- [ ] `keys.ts` carga clave priv/pub por `kid` (rotación)
- [ ] `sign-license` emite JWT firmado (exp corto, claims de F8)
- [ ] `verify-license` valida firma + exp + scope
- [ ] `verification-cache` (cache + grace period anti lock-out)
- [ ] `license-guard` previo a IA con cache/grace (consumido por F3)
- [ ] Cableado con F3 (wrapper del adaptador llama al guard)
- [ ] Secrets de firma server-only (coordinado F0/F11)
- [ ] Tests: válido/expirado/inválido/scope + rotación (delegados a F12)

## Success Criteria
- `LICENSE` y `docs/licensing.md` expresan claramente fair-code: interno permitido, comercial restringido a hosting/licencia oficial. La restricción comercial es **legal**, no técnica.
- Dentro del servicio oficial, toda llamada a IA pasa por `license-guard`; tras grace agotado sin token válido → `LicenseError` y cero consumo.
- La clave de firma y `OPENROUTER_API_KEY` nunca aparecen en cliente/RSC payload.
- El servicio oficial es la **barrera operativa** (posee la key/infra); un fork que aporte su propia key queda cubierto por la **licencia**, no por el código.
- Cache + grace period evitan lock-out propio ante fallo transitorio; rotación por `kid` sin caída.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Lock-out propio si el servicio de licencia/firma cae | Media | Alto | `verification-cache` + grace period: se sirve con el último resultado válido ante glitch; solo tras agotar grace fail-closed con mensaje accionable; rotación sin downtime vía `kid` |
| Creer que el JWT impide un fork (falsa seguridad) | Media | Alto | Documentar explícito: control LEGAL (SUL) + OPERATIVO (key/infra oficial); el guard es UX/billing/scope, no anti-fork; un fork con su key funciona y lo cubre la licencia |
| Clave privada de firma o `OPENROUTER_API_KEY` filtrada al cliente | Baja | Crítico | Solo `src/lib/licensing/**` server-side; lint/guard contra uso en cliente; secrets fuera del repo |
| Gate esparcido por F5/F7 deja una ruta a IA sin check | Media | Alto | Punto único en el wrapper del adaptador F3 (DRY); test que verifica que toda llamada a IA pasa por `license-guard` |
| Texto de licencia con ambigüedad legal (fair-code vs OSI) | Media | Alto | Basar en SUL de n8n; revisión legal; `docs/licensing.md` aclara casos de uso |
| Token reutilizable / replay si `exp` largo | Media | Medio | `exp` corto + refresh; scope acotado; no exponer token con valor fuera de sesión al cliente |
| Solape con F3/F8 al cablear el guard | Media | Medio | F13 expone el guard; F3 edita su wrapper; F8 provee plan/scope; globs disjuntos |

## Security Considerations
- Clave privada de firma y `OPENROUTER_API_KEY` **exclusivamente** server-side; nunca en props, RSC payload ni respuestas al cliente.
- JWT asimétrico (firma con privada, verificación con pública por `kid`); `exp` corto, scope mínimo necesario.
- Fail-closed **tras grace agotado**: ante fallo persistente del servicio de claves no se consume IA; un glitch transitorio se cubre con cache+grace (no corta el servicio propio).
- El control es **legal + operativo**, no de ofuscación: el código es legible/forkeable; la barrera práctica es la infra/key oficial y la restricción de la licencia, no el guard en sí.
- `docs/licensing.md` no debe inducir a creer que es OSI-open-source; declarar fair-code explícitamente.

## TDD / Pruebas primero
Escribir ANTES del guard/verify (rojo→verde→refactor), unit/Vitest (firma asimétrica, sin red):
- **Fail-closed con grace period**: ante fallo transitorio del servicio de claves, el guard sirve el último resultado válido durante el grace (NO lock-out); solo tras agotar el grace → `LicenseError` y la IA no se consume. Rojo sin `verification-cache`.
- **Token válido/expirado/inválido/scope**: válido pasa; `exp` vencido, firma inválida o scope incorrecto → `LicenseError` tipado y cero consumo de IA.
- **Rotación por `kid`**: una clave rotada (nuevo `kid`) verifica correctamente sin downtime.
- **Punto único**: test que verifica que toda ruta a IA pasa por `license-guard` (no hay bypass en F5/F7).
- **Mock:** se mockea el servicio de claves/reloj (para simular `exp` y fallo transitorio). NO se mockea la verificación de firma ni la lógica de grace (es lo que se prueba).

## Next Steps
Cierra el modelo de negocio (capa técnica): el plan/scope de F8 determina emisión del token; F3 cablea el `license-guard` en el wrapper del adaptador. **Post-MVP (B2C es el segmento primario del MVP):** **onboarding comercial B2B y flujo de venta/contratación de licencia comercial**, servicio de licencia dedicado (emisión/rotación remota), portal de gestión de licencias, telemetría de uso por licencia y endurecimiento del refresh.
