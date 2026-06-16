# Red Team — Viabilidad de ejecución del equipo en paralelo (Habiteka MVP)

Vector: ROMPER el plan desde la ejecución real de 7 roles / 19 fases / 1 repo.
Veredicto: el plan es sólido en *arquitectura de ownership* pero **vende paralelismo que la cadena de dependencias no permite**, y el "contract freeze" oculta varios puntos donde dos roles DEBEN tocar lo mismo.

## Dónde se rompe en la práctica

### CRÍTICO

**C1 — F2 debe congelar el schema completo de fases que aún no existen (F8/F9/F10/F16/F17/F18).**
F2 declara 7 modelos admin + campos "congelados" de Subscription/VotingRoom/MarketplaceItem + `ModelConfig`/`BrandSettings`/`MediaAsset`. Pero F16/F17/F18 arrancan *después* y F16 admite literalmente "Proponer a F2 los modelos" (phase-16 paso 1) — el productor real del diseño es F16/F17, no F2. Escenario: M3 arranca F16, descubre que `BrandSettings` necesita `logoMobileAssetId` o `MediaAsset.status` un enum extra → reabre `prisma/**` (owner BE/F2) a mitad de M3 → migración tardía + el BE owner está en F8. **Por qué falla:** el plan invierte el orden lógico (quien sabe los campos llega tarde) y el "congelado aditivo" solo cubre lo *previsto*; lo no previsto rompe el contrato de ownership `prisma/**`.

**C2 — Cadena crítica F0→F2/F3→F5→F6→F7 es estrictamente secuencial; el "paralelismo" es marginal.**
F4‖F5, pero F6 necesita F4+F5, F7 necesita F5+F6, F8 necesita F6. El núcleo de producto (canvas→agente→chat→feedback→créditos) es una tubería de ~5 eslabones que **un solo rol (IA) posee en 3 de ellos** (F3,F5,F7). Escenario: IA es el cuello real, no F5 puntual; FE espera a IA en F6 y otra vez en F7. **Por qué falla:** 7 roles no se traducen en 7 vías de trabajo; hay 2-3 vías reales (núcleo IA/FE serial + BE-datos + admin) → la estimación implícita de "MVP paralelo" es optimista por factor ~2x.

**C3 — No existe fase de INTEGRACIÓN/ensamblaje.** El plan tiene M1.5 (typecheck de contratos) pero ningún hito donde alguien cablee agente real + canvas real + créditos real + stream end-to-end con datos vivos. F12 es "transversal" (no es un owner de integración). Escenario: cada pieza pasa sus tests con *mocks deterministas* (F5 mockea ImageAdapter+DebitService; F7 mockea ambos; F6 mockea advance/stream) → en M3-M4 al juntar, aparecen desajustes de forma de `AgentStreamEvent`, de máscara `InpaintRequest`, de coste→crédito. **Por qué falla:** "verde con mocks" ≠ "verde integrado"; sin owner ni hito de ensamblaje, los desajustes se descubren tarde y sin dueño.

### ALTO

**A1 — Stub eterno de `DebitService` (F0 contrato → F5/F7 lo consumen en M2 → F8 lo implementa en M3).** F5/F7 se desarrollan y testean contra un stub. Escenario: F8 implementa `hold/settle/revert` con lock de fila + saldo materializado y descubre que la semántica real (hold falla por saldo insuficiente = gating duro, revert parcial, idempotencyKey colisiona) no coincide con cómo F5 invocó el stub (orden, manejo de error `insufficient_credits`). **Por qué falla:** el contrato F0 fija la *firma* pero no el *comportamiento bajo error*; F5 codifica supuestos que F8 invalida → re-trabajo en `agent/entrega.ts` y `feedback-orchestrator.ts` en M3.

**A2 — `.env.example` es un fichero compartido de facto entre 4 roles.** F0 lo crea, F2 lo "modifica (coordinar con F0/F11)", F8 añade `POLAR_*`, F17 añade `MINIO_*`, F3 `IMAGE_PROVIDER`/keys, F11 lo lee. Owner declarado: ARQ (F0). Escenario: merges concurrentes de F2/F8/F17 sobre el mismo fichero → conflictos triviales pero recurrentes; peor, una clave que falta en CI rompe el pipeline de OTRO rol. **Por qué falla:** un único fichero con 4 escritores y un owner que no está en el loop de cada cambio = fricción de merge garantizada (la mitigación "coordinar" no es un mecanismo).

**A3 — `model-config-loader` fuerza a F16 a depender de que F3 edite su propio fichero.** phase-16 dice explícito: "F3 edita su propio fichero", "coordinar con F3 que `model-routing` consume el loader". Escenario: F16 (M3) no puede cerrar hasta que F3 (M1) haya migrado `model-routing` a leer BD; si F3 lo dejó hardcodeado con "default seguro", F16 entrega un editor que no surte efecto. **Por qué falla:** dependencia de trabajo real cross-hito (M3 depende de un detalle de implementación de M1) que no aparece en el grafo de fases; el riesgo "F3 sigue hardcodeando" ya está listado en F16 — el plan lo conoce pero lo deja como "coordinar".

### MEDIO

**M1 — Sin estrategia de ramas declarada.** 7 roles, 1 repo, M1.5/M3 con merges concurrentes. F11 menciona `dev`/staging/prod pero no feature-branches por rol ni worktrees. Riesgo merge-hell moderado (ownership por globs lo amortigua) pero `prisma/migrations/**` es serial por naturaleza: dos migraciones concurrentes (F2 base + F8 campos cycle + F17 media) chocan en numeración/orden. **Por qué falla:** las migraciones no respetan el aislamiento por glob; necesitan un único serializador.

**M2 — El "contract freeze gate" es frágil ante 11 contratos escritos antes de implementar nada.** F0 congela `Plano2dPayload`, `AgentStreamEvent`, `CanvasZone`, `InpaintRequest` sin que F5/F6/F7 hayan probado que son suficientes. Probabilidad alta de PR de cambio de contrato a mitad de M2 (el propio plan lo prevé "vía PR de ARQ") → cada cambio toca por construcción a múltiples roles. **Por qué falla:** congelar interfaces de UX/streaming/máscara antes del primer uso real es adivinar; el gate convierte cada corrección inevitable en evento de cascada.

## Supuestos optimistas del plan

1. "Paralelizable tras F0: F1,F2,F3,F11" — cierto, pero el **núcleo de producto es serial** (C2); el paralelismo se agota tras M1.
2. "Campos congelados aditivos evitan migración tardía" — solo cubre lo previsto; F16/F17 son los que *saben* los campos y llegan en M3 (C1).
3. "Stub satisface la interfaz" ⇒ F5/F7 correctos — la firma no captura comportamiento bajo error/gating (A1).
4. "F12 acompaña cada fase" sustituye a integración — no hay owner que ensamble el flujo vivo (C3).
5. "MVP completo" con 5 fases agente + render 3D + inpainting + add-ons + créditos + Polar + back-office completo (4 fases admin) + RGPD + licencia fair-code = **scope de 4-6 meses con equipo senior, no un MVP**. El alcance es honesto en detalle pero deshonesto en la etiqueta "MVP".

## Recomendaciones accionables

1. **Invertir C1/A3:** mover el *diseño* de modelos admin (ModelConfig/Brand/Media) y del `model-config-loader` a una sub-fase temprana co-propiedad ARQ+BE+IA dentro de M1, ANTES de congelar `prisma/**`. Que F16/F17 validen el schema en M1, no que lo "propongan" en M3.
2. **Añadir hito de INTEGRACIÓN explícito (M2.9 / pre-M3):** un owner (ARQ o BE) cablea agente real + canvas + stream + un débito real contra DB, sin mocks, end-to-end de una entrega. Es la puerta a M3, no F12.
3. **Promover `DebitService` de stub a implementación-mínima-real en M2** (saldo en memoria/DB simple con la misma semántica de error/gating que F8 usará), para que F5/F7 codifiquen contra comportamiento, no solo firma. F8 lo endurece, no lo redefine.
4. **Declarar branching + serializador de migraciones:** worktree o feature-branch por rol; `prisma/migrations/**` con un único turno de merge (BE owner serializa). Trocear `.env.example` en `.env.example` + fragmentos por dominio o asignar a OPS un PR de consolidación por hito.
5. **Re-etiquetar el alcance:** declarar M1+M2 como "MVP real" (flujo de las 5 fases + créditos básicos) y mover add-ons (F9/F10), back-office completo (F16-F18), licencia fair-code (F13) a "post-MVP / v1". El plan ya tiene hitos — alinear la palabra "MVP" con M1+M2.

## Top 3-5 problemas (priorizado)
1. **C1** — `prisma/**` se reabrirá en M3 (productor de campos llega tarde). → Rec. 1
2. **C3** — sin fase de integración; "verde con mocks" engaña. → Rec. 2
3. **C2** — núcleo serial; paralelismo sobrevendido ~2x. → Rec. 5 (re-scope)
4. **A1** — stub DebitService diverge de F8. → Rec. 3
5. **A2/M1** — `.env.example` y `prisma/migrations` son cuellos de merge sin mecanismo. → Rec. 4

## Preguntas sin resolver
- ¿Hay deadline real? Sin él no se puede juzgar si el scope "MVP completo" es suicida o solo ambicioso.
- ¿El equipo es 7 personas reales o 7 roles repartidos en menos personas? Si <7, C2 (serialidad) se agrava.
- ¿Quién es el owner de integración? Hoy: nadie.

**Status:** DONE
