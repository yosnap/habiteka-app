# Changelog — Habiteka

Cambios significativos, features e hitos se documentan aquí. Formato [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added — 2026-06-16

- **Bootstrap del proyecto:** especificación técnica leída y validada.
  - Stack cerrado: Next.js 16.2, React 19.2, TypeScript 5, Tailwind v4, shadcn/ui, Konva 10.3.
  - Arquitectura aprobada: monolito modular, agente intérprete (5 fases), extensibilidad fair-code.
  - Plan por roles generado: F0-F19 con grafo de dependencias, hitos M0-M4 (incremental).
  - Validation pipeline: predict (6 roles), consistencia (11 contratos), TDD (test-first), red team (6 vectores).

- **Documentación base creada:**
  - `docs/system-architecture.md` — diseño conceptual, stack tecnológico, modelo de datos, agente 5 fases.
  - `docs/code-standards.md` — convenciones (kebab-case, archivos ≤200 líneas, TypeScript strict, TDD).
  - `docs/development-roadmap.md` — fases F0-F19, hitos M0-M4, decisiones clave documentadas, riesgos abiertos.
  - Plan detallado en `plans/260616-2004-habiteka-mvp-equipo/` con phase files.

- **Setup técnico completado:**
  - Repo público `yosnap/habiteka-app` creado en GitHub.
  - Branching avanzado instalado: rama por tarea `feat/<rol>/<task>` → `develop` (gate team lead) → `main` (bloqueada, semver).
  - CI/CD base preparado (F11 en roadmap).

- **Decisiones de negocio documentadas:**
  - MVP completo: 5 fases agente + render 3D + add-ons (votación, marketplace) + créditos + admin dashboard.
  - Fair-code license + control operativo (legal + infraestructura).
  - TDD obligatorio + mocks solo servicios externos (OpenRouter, Polar, imagen) — cero net en CI.
  - Contract freeze gate (F0 congelado antes M2); M0 quality gate (spike render 3D) — GO/NO-GO antes M2.

- **Riesgos abiertos identificados:**
  - Re-scope del MVP (inclusión votación/marketplace/render 3D) — producto decide.
  - Modelo de pricing (por intento vs por resultado) — afecta F8 logic y conversión.

### Deferred

- Feature implementation (F0-F19) — planificado, no comenzado.
- Integración de servicios externos (OpenRouter, Polar, proveedor imagen) — depende de hitos.

---

**Inicio del proyecto:** 2026-06-16 | **Versión:** 0.0.0 (pre-alpha) | **Equipo:** 7 roles (ARQ, BE, FE, IA, UX, QA, OPS)
