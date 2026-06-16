# Bootstrap de Habiteka: Plan + 4 Validaciones

**Date**: 2026-06-16 22:29
**Severity**: Medium (decisiones no técnicas abierto)
**Component**: Arquitectura + Plan maestro
**Status**: Resolved (plan aceptado; código no comienza)

## Qué pasó

Bootstrpeamos Habiteka desde repo vacío: arquitectura de 22 fases (F0-F19 + spike F-S0 + integración F-INT), stack cerrado post-verificación (Next 16.2, React 19.2, TS5, Tailwind v4, Konva 10.3, Prisma 7, Better Auth 1.6, OpenRouter→OpenAI SDK, S3/MinIO, Polar.sh), plan por ROLES paralelos con grafo de dependencias. Corrimos 4 pases de validación: predicción de roles, consistencia interna, TDD test-first, red team 6 vectores (seguridad, scaling, idempotencia, DR, integración, legal).

## La Verdad Brutal

Había una mentira técnica cómoda: creíamos que controlar el JWT/licencia (`F13-licenses`) bloqueaba forks ilegales. Red team nos frenó: eso es ilusión operativa, no barrera técnica. El control debe vivir en la BD (ownership estructural), paired con auditoría, backup, reaper de credits huérfanos. Duele: gastamos 2 rondas de fix para entender que la seguridad no es un parche final.

Más: researchers asumieron Next 15. Usuario exigió verificar versiones reales (junio 2026). Encontramos 16.2 → refactorizamos task breakdown. LECCIÓN: en 2026 el npm landscape cambia cada trimestre; "asumir" cuesta 2 horas después.

Y el MVP mentiroso: red team dice que F0-F19 es 4–6 meses. Usuario sigue diciendo "MVP". No lo es. Es un producto viable con dashboard admin, integración IA de 5 fases, pagos, DR. El scope es real; la etiqueta es aspiracional.

## Detalles Técnicos

- **Hallazgos red team aplicados:** idempotencia de créditos (máquina de estados: RESERVED→CONSUMED), `CreditBalance` con lock de fila (SELECT FOR UPDATE en Postgres), ownership estructural vía `user_id+company_id`, reaper async de holds huérfanos (cron), caps+allowlist de modelos OpenRouter, fallback de gateway (OpenRouter = SPOF → pre-validar en worker), backup diario+DR (S3 + cross-region replicas).
- **Dashboard admin (F15–F18)** insertado mid-plan: usuarios, config dinámica de modelos (BD editable), branding, media manager (MinIO + carpetas organizadas), analítica/facturación por usuario.
- **Branching:** repo público (github.com/yosnap/habiteka-app), main+develop protegidas, PR #1 abierto. Rama por tarea → PR a develop (team lead merge) → develop→main por versión menor.
- **Riesgos abiertos (decisión de negocio, sin fijar):** rescope del MVP (¿4–6 meses es aceptable?), pricing (pago por intento vs. por créditos consumidos), proveedor imagen (FLUX vs. Nano Banana vs. Imagen GCP).

## Lecciones

1. **Verificar versiones reales en día 1**: no asumir; npm landscape de mid-2026 es dinámico. Costo del fix: 2h. Costo de descubrirlo en F5: 20h de refactor.
2. **Seguridad operativa, no técnica**: JWT/licencia NO bloquea fork. Ownership estructural en BD + auditoría + DR sí. Controles múltiples.
3. **Scope vs. label**: no etiquetar como MVP lo que son 22 fases y 4–6 meses. Claridad para stakeholders desde el inicio.
4. **Plan por roles + grafo de dependencias escala**: 6 equipos en paralelo, sin deadlock (F0–F6 bloqueados en infraestructura, F7+ liberados después). Funciona.

## Próximos Pasos

- [ ] Usuario acepta riesgos abiertos (MVP scope, pricing model, vendor imagen) o escalamos decisiones a producto.
- [ ] Comienza implementación: F0 (setup) asignado a infra lead, F1–F3 (DB schema, auth, canvas) en paralelo a 3 devs.
- [ ] Spike F-S0 (QA IA via synthetic tests) corre en paralelo a F0–F4 (no bloqueado).
- [ ] Red team documenta en `docs/security-design.md` cada hallazgo + mitigación (idempotencia, locks, ownership, reaper, caps).

**Propiedad:** Team lead (decision), devs por fase (implementación), security (F-S0 + auditoría mensual).

**Timeline:** Red team señala 4–6 meses. Depende de confirmación de scope.
