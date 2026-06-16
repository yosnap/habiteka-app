# Development Roadmap — Habiteka MVP

> Documento vivo. Fases F0–F19 con dependencias, hitos incrementales (M0–M4), y estado actual (planning → implementation → release).

## Estado General

**Fase actual:** Planificación completada (2026-06-16). MVP especificado, stack cerrado, plan validado por arquitectura + predict + consistencia + TDD + red team. Implementación pendiente.

**Progreso:** 0% (bootstrap completado).

## Fases por Hito

### M1 — Cimientos (F0, F1, F2, F3, F11)

| Fase | Rol | Alcance | Depende | Estado |
|------|-----|---------|---------|--------|
| **F0** | ARQ | Setup repo, 11 contratos (freeze gate), licencia base | — | Planificado |
| **F1** | UX | Design system, wireframes, disclaimers UI | F0 | Planificado |
| **F2** | BE | Datos Prisma, Better Auth, scoping, /api/health | F0 | Planificado |
| **F3** | IA | Adaptadores OpenRouter (chat/visión) + imagen | F0 | Planificado |
| **F11** | OPS | CI/CD, Docker, secrets, health check | F0 | Planificado |

**Salida:** Repo base, contratos congelados, BD+auth, adaptadores IA, pipeline CI.

### 🔒 Contract Freeze Gate

Contratos de F0 se congelan. Cambios posteriores vía PR revisado por ARQ.

### M1.5 — Contract Validation

- TypeScript strict check: F2, F3, F4 importan e satisfacen F0.
- Build verde con tipos completos.

### 🚦 M0 — Quality Gate (F-S0: Spike)

| Fase | Rol | Alcance | Depende | Estado |
|------|-----|---------|---------|--------|
| **F-S0** | IA + Producto | Spike: render 3D (15-20 muestras), plano 2D, visión | F0, F3 | Planificado |

**Decisión crítica (§9.1):** ¿FLUX / Nano Banana / Imagen? Spike decide. **GO/NO-GO:** si NO pasa, M2 se pausar. Si GO, M2 arranca.

### M2 — Flujo Core (F4, F5, F6, F7)

| Fase | Rol | Alcance | Depende | Estado |
|------|-----|---------|---------|--------|
| **F4** | FE | Canvas Konva + controles | F1, F2 | Planificado |
| **F5** | IA | Agente: 5 fases, state machine, persistencia | F2, F3 | Planificado |
| **F6** | FE | Chat + panel entregables + UI add-ons base | F4, F5 | Planificado |
| **F7** | IA+BE | Feedback por zona, render 3D, inpainting | F3, F5, F6 | Planificado |

**DebitService:** pasa a implementación mínima REAL (no stub).

**Salida:** 5 fases agente funcionando; feedback refinable.

### 🔗 M-INT — Integración End-to-End

| Fase | Rol | Alcance | Depende | Estado |
|------|-----|---------|---------|--------|
| **F-INT** | Tech Lead / Fullstack | Flujo vivo sin mocks: ingesta→feedback con BD real | F5, F6, F7, F8 | Planificado |

Detecta desajustes de contrato. Puerta M2 → M3.

### M2.5 — Back-office Base (F15)

| Fase | Rol | Alcance | Depende | Estado |
|------|-----|---------|---------|--------|
| **F15** | FE+BE | Admin shell + users, requireAdmin guard | F2 | Planificado |

Arranca pronto; desbloquea pruebas operativas.

### M3 — Negocio + Add-ons + Admin (F8, F9, F10, F13, F16, F17)

| Fase | Rol | Alcance | Depende | Estado |
|------|-----|---------|---------|--------|
| **F8** | BE | Créditos hold/settle, Polar webhooks, pricing | F2, F6 | Planificado |
| **F9** | FE+BE | Add-on Votación comunitaria | F4, F6 | Planificado |
| **F10** | FE+BE | Add-on Marketplace (seed DB + afiliación) | F4, F6 | Planificado |
| **F13** | ARQ | Licencia fair-code (legal + operativo) | F3, F8 | Planificado |
| **F16** | FE+BE | Admin: config modelos (BD), branding, flags | F2, F3, F15 | Planificado |
| **F17** | FE+BE | Admin: media manager, StorageAdapter/MinIO | F2, F0, F15 | Planificado |

**Salida:** Negocio operativo (pagos, créditos); dashboard admin para operar sin redeploy.

### M4 — Analítica + Hardening + Cumplimiento (F12, F14, F18, F19)

| Fase | Rol | Alcance | Depende | Estado |
|------|-----|---------|---------|--------|
| **F12** | QA | Suite completa: unit, integration, e2e, coverage gates | todas | Planificado |
| **F14** | ARQ/Legal+BE | RGPD: privacidad, retención, supresión, DPA | F2 | Planificado |
| **F18** | FE+BE | Admin: analítica, facturación, auditoría (read-only) | F2, F3, F8, F15 | Planificado |
| **F19** | ARQ/Legal+BE+FE | ToS/EULA, banner cookies, DPIA art. 35 | F14 | Planificado |

**Bloqueante UE:** F14 + F19 juntas habilitanodos para usuarios EU.

**Salida:** Plataforma production-ready, conforme RGPD/ToS/privacidad.

## Decisiones Clave Documentadas

| Decisión | Rationale | Estado |
|----------|-----------|--------|
| Stack: Next.js 16 + React 19 + TS5 + Tailwind v4 + shadcn/ui | Modern, full-stack, DX. | ✅ Cerrado |
| OpenRouter (baseURL chat+visión) | Unified billing, modelo-agnostic, fallback. | ✅ Cerrado |
| Render 3D en MVP | Clave de valor; spike valida calidad. | ✅ Cerrado (M0 decide proveedor) |
| Add-ons en MVP (votación + marketplace) | User engagement; interfaces extensibles. | ✅ Cerrado |
| Fair-code license + control operativo | Legal + infraestructura como barrera. | ✅ Cerrado (F13 implementa) |
| Dashboard admin (F15-F18) | Operación sin redeploy (config BD, branding, analítica). | ✅ Cerrado |
| Branching: feat/<rol>/<task> → develop → main | Ownership por rol + gate único (team lead). | ✅ Cerrado |
| Créditos + suscripción (Polar) | B2C monetización; hold/settle pattern. | ✅ Cerrado (F8 implementa) |
| Contratos congelados (F0 freeze gate) | Previene cascadas de cambios. | ✅ Cerrado |
| **TDD + test-first en todas las fases** | Confianza, refactorización segura. | ✅ Cerrado |
| **Mocks solo servicios externos** (OpenRouter, Polar, imagen) | Aisla lógica propia; cero integración real en CI. | ✅ Cerrado |

## Riesgos Abiertos (Decisión de Negocio)

| Riesgo | Impacto | Propuesto (sin confirmar) |
|--------|---------|--------------------------|
| **Re-scope del MVP:** ¿Incluir votación? ¿Render 3D? ¿Marketplace? | Scope creep → retrasos M2-M3. | Producto decide; comunicar a equipo ASAP. |
| **Modelo de pricing:** ¿Por intento o por resultado? | Afecta a F8 (DebitService logic); conversión BCV. | Producto + financiero; F8 espera claridad. |

## Progreso (%)

| Hito | Fases | Completión | Comentario |
|------|-------|-----------|-----------|
| Planning | F0 (partial), plan, architecture | 100% | Especificación leída, plan validado. |
| M1 | F0, F1, F2, F3, F11 | 0% | Implementación no comenzada. |
| M1.5 | Contract validation | 0% | Espera M1 completado. |
| M0 (Gate) | F-S0 | 0% | Espera F3 (adaptadores). |
| M2 | F4, F5, F6, F7 | 0% | Espera M0 GO. |
| M-INT | F-INT | 0% | Espera M2. |
| M2.5 | F15 | 0% | Paralela M2. |
| M3 | F8, F9, F10, F13, F16, F17 | 0% | Espera M2 + M-INT. |
| M4 | F12, F14, F18, F19 | 0% | Espera M3. |

**Total MVP:** 0% (bootstrap completado, implementación pendiente).

## Próximos Pasos

1. **Equipo inicia F0** (ARQ): setup repo, 11 contratos, tsconfig, package.json.
2. **Paralelizar F1, F2, F3, F11** tras F0.
3. **M1.5 gate:** TypeScript check que F2/F3 satisfacen F0.
4. **M0 gate:** Spike valida render 3D (decide proveedor) → GO/NO-GO para M2.
5. **Si GO:** M2 paraleliza F4/F5/F6/F7.
6. **M-INT:** Ensamblaje sin mocks; detecta desajustes.
7. **M3/M4:** Add-ons, negocio, compliance (RGPD/ToS).

---

**Última actualización:** 2026-06-16 (bootstrap). Próxima revisión: fin M1.
