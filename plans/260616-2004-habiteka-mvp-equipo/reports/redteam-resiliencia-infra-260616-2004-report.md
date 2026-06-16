# Red Team — Resiliencia de proveedores / infra / operaciones (Habiteka MVP)

> Vector: SRE post-3am. El plan cubre bien spend-guard, hold/settle, idempotencia de webhooks, grace period de licencia y anti-SSRF. Lo que sigue es lo que el plan NO maneja: modos de fallo OPERACIONALES en producción.

## Modos de fallo no manejados (crítico / alto / medio)

### CRÍTICO — OpenRouter es SPOF total sin plan B inter-gateway
- **Escenario (F3):** El fallback documentado es ENTRE modelos vía `extra_body.models`, todos a través de `openrouter.ai/api/v1`. Si OpenRouter cae, rate-limita la cuenta, tiene un incidente regional o cambia auth, TODO el producto (las 5 fases del agente, render, inpaint) se detiene. Un único `baseURL`, una única `OPENROUTER_API_KEY`.
- **Impacto operacional:** 100% de indisponibilidad del valor central. No hay degradación parcial, no hay segundo gateway (OpenAI/Anthropic/Together directos), no hay "modo solo-chat" si la imagen cae. El circuit-breaker de `spend-guard` protege el SALDO, no la DISPONIBILIDAD: cuando dispara, también deja el producto inservible sin ruta alternativa.
- **Lo que falta:** abstracción a nivel de GATEWAY (no solo de modelo). El `model-config-loader` ya es BD-driven; extenderlo a `provider/baseURL` por acción daría conmutación sin redeploy. Sin esto, un incidente de OpenRouter = caída total con MTTR = "lo que tarde OpenRouter".

### CRÍTICO — Sin estrategia de backup/restore ni DR de Postgres (RPO/RTO indefinidos)
- **Escenario (F11, F2):** "Postgres gestionado real" se menciona; backup solo aparece como "backup DB antes de migrar" (puntual, ligado a deploy). No hay política de backups continuos, PITR, prueba de restore, RPO ni RTO. Postgres guarda 20+ modelos incl. `CreditLedger` (libro mayor financiero append-only) y estado de canvas en JSONB.
- **Impacto operacional:** corrupción/borrado/región caída = pérdida de saldos de créditos de clientes que PAGARON (vía Polar MoR) → disputa legal + chargebacks. Sin restore probado, el RTO es desconocido a las 3am. Un ledger financiero sin backup verificado es inaceptable.
- **Lo que falta:** PITR habilitado, retención definida, restore probado periódicamente (un backup no restaurado no existe), RPO/RTO declarados, runbook de restore.

### ALTO — Licencia fail-closed: un glitch del servicio de firma puede tumbar TODO el producto, no solo lo comercial
- **Escenario (F13):** `license-guard` es el punto ÚNICO previo a toda IA (DRY, por diseño). Tras agotar grace, fail-closed corta IA. El grace period no tiene duración definida, ni la verificación cachea por usuario vs global, ni hay "modo degradado" que distinga usuario interno/pagado de comercial.
- **Impacto operacional:** si la clave de firma se rota mal, el `kid` no carga, o la verificación tiene un bug, el grace se agota y se cae el producto ENTERO para usuarios legítimos que pagaron — por un control cuyo propósito es comercial/anti-fork, no de runtime. El propio plan admite que el fork puede borrar el guard: el guard solo penaliza al operador oficial cuando falla. Asimetría de riesgo perversa: el guard nunca detiene a un atacante real, pero sí puede detener a tus clientes.
- **Lo que falta:** grace period largo y configurable, verificación 100% local sin red por request (clave pública en memoria, no fetch), fallback "permitir si la firma pública está cargada aunque el servicio remoto no responda", y un kill-switch operacional que desactive el guard sin redeploy si causa un incidente.

### ALTO — MinIO sin HA, backups ni manejo de bucket lleno (pérdida de assets)
- **Escenario (F17):** `StorageAdapter`→MinIO single-node implícito. No hay HA (¿erasure coding? ¿réplica?), ni backup del bucket, ni replicación a otro destino. Cuota existe (`quota.ts`) pero protege contra abuso de usuario, no contra disco lleno del nodo. Branding (logos) y media referencian `MediaAsset.id`; si MinIO pierde objetos, la BD apunta a keys muertas (dangling references).
- **Impacto operacional:** fallo de disco = pérdida permanente de imágenes subidas (render, logos de branding, biblioteca). Disco lleno del nodo = uploads fallan globalmente aunque ningún usuario haya excedido su cuota. Presigned PUT directo a MinIO significa que un upload puede llenar el disco SIN pasar por el server (la validación es POST-upload).
- **Lo que falta:** decisión explícita de HA/replicación de MinIO o usar S3 gestionado en prod (el adaptador ya lo permite — usarlo); backup/versionado del bucket; alerta de uso de disco del NODO (no solo cuota de usuario); reconciliación BD↔bucket para detectar dangling.

### ALTO — Self-host vs Vercel sin decidir: carga operativa no dimensionada
- **Escenario (F11):** "se elige uno para el MVP, decisión a confirmar". Self-host fair-code implica operar app + Postgres + MinIO + secrets + observabilidad uno mismo. El plan no dimensiona esa carga: no hay rotación de secrets, no hay agregación de logs centralizada, no hay on-call, no hay alerting más allá de "error-rate + healthcheck".
- **Impacto operacional:** si se elige self-host por coherencia fair-code, el equipo hereda operar 3 sistemas con estado sin runbooks de DR, sin rotación de secrets y sin observabilidad real. A las 3am no hay dashboard que diga qué está roto. La decisión pendiente bloquea dimensionar backups, HA y on-call.
- **Lo que falta:** decidir el target ANTES de M3; si self-host, presupuestar operación (backups, secrets rotation, log aggregation, paging). Recomendación pragmática: Vercel + Postgres gestionado + S3 gestionado para el MVP oficial; self-host como artefacto documentado para uso interno de terceros (que es lo que la licencia fair-code realmente necesita).

### MEDIO — Observabilidad de coste sin alerting real (runaway silencioso)
- **Escenario (F3):** `spend-guard` tiene cap diario y circuit-breaker, pero NO hay dashboard de gasto en tiempo real, ni ALERTA proactiva antes de tocar el cap, ni vista de coste por org/usuario/acción para operaciones. El cap protege; pero el operador se entera del problema cuando el breaker ya disparó (servicio caído para ese usuario), no antes.
- **Impacto operacional:** un cambio de precios de OpenRouter o un modelo más caro mal configurado en `ModelConfig` puede multiplicar el coste real sin que `pricing-table` (créditos) se entere — el plan ya nota "coste real ≠ estimado". Pérdida de margen silenciosa hasta el cierre de mes. Editar `ModelConfig` en caliente (sin redeploy, por diseño) significa que un admin puede apuntar a un modelo carísimo sin gate de coste.
- **Lo que falta:** dashboard de gasto OpenRouter real-time, alerta al 70/90% del cap, coste por org, y validación de coste al guardar `ModelConfig` (advertir si el modelo nuevo es N× más caro).

### MEDIO — CI sin integración real contra sandboxes: la integración se descubre rota en prod
- **Escenario (F11, F12):** "cero llamadas reales a IA/pagos en CI" es correcto para unit/integration deterministas. Pero NO hay NINGÚN punto donde se ejecute un test de integración real contra el sandbox de OpenRouter, el proveedor de imagen elegido, o el sandbox de webhooks de Polar. El "smoke test real" de F3 es opcional y manual.
- **Impacto operacional:** los fakes/firmador local pueden divergir del contrato real (cambio de formato de `usage`, nuevo campo en webhook de Polar, cambio en `response_format`). Se descubre en producción que la firma de webhook de Polar cambió, o que el structured output del modelo nuevo no valida. El smoke a `/api/health` no ejerce IA ni pagos.
- **Lo que falta:** un job nightly/staging (no en PR) que ejerza OpenRouter dev-key + sandbox de Polar + un upload real a MinIO. No bloquea PRs; detecta drift de contrato antes de prod.

## Lo que el plan asume que siempre funciona

1. **OpenRouter está arriba, mantiene precios y no deprecia modelos.** No hay segundo gateway. El fallback es intra-OpenRouter.
2. **Polar (MoR) no cae, no cierra la cuenta, no cambia API.** Subió precios en 2026 (riesgo real). Si Polar suspende la cuenta, el cobro se detiene por completo y no hay ruta de migración de suscripciones/MoR documentada. Lock-in del proveedor de cobro no analizado.
3. **El proveedor de imagen elegido sigue existiendo.** El adaptador es conmutable (bien), pero solo se implementa 1 proveedor; los otros son stubs sin probar — conmutar bajo incidente significa terminar+probar un stub a las 3am.
4. **El servicio de firma de licencia y la rotación de `kid` nunca fallan más allá del grace.** Grace sin duración definida.
5. **Postgres no se corrompe, no se borra y la región no cae.** Backup solo pre-migración.
6. **MinIO single-node sobrevive (disco, proceso).** Sin HA ni backup.
7. **Los fakes de CI reflejan los contratos reales de OpenRouter/Polar/proveedor-imagen.** Sin verificación de drift.

## Recomendaciones accionables (priorizadas)

1. **[F3] Abstraer GATEWAY, no solo modelo.** Extender `model-config-loader`/`model-routing` a `{provider, baseURL, keyRef}` por acción. Implementar al menos un segundo gateway (OpenAI o Anthropic directo) como fallback configurable en BD. Convierte un SPOF total en degradación. — antes de M2.
2. **[F11/F2] Política de backup+DR de Postgres con restore PROBADO.** PITR, RPO/RTO declarados, restore ensayado y runbook. Bloqueante de lanzamiento por el `CreditLedger` financiero. — antes de M3 (cuando entra dinero).
3. **[F13] Hacer el license-guard imposible de auto-DoS.** Verificación 100% local (clave pública en memoria), grace largo configurable, kill-switch sin redeploy. El guard nunca debe poder tumbar a usuarios pagados. — junto con F13.
4. **[F17/F11] Decidir storage de prod = S3 gestionado (o MinIO con HA+backup explícito).** El adaptador ya lo permite; usar S3 gestionado en el deploy oficial. Alerta de disco a nivel NODO. Reconciliación BD↔bucket. — antes de M3.
5. **[F11] Decidir target de deploy AHORA (recomendado: Vercel + Postgres/S3 gestionados para oficial; self-host como artefacto para terceros).** Desbloquea dimensionar backups/HA/secrets/observabilidad. — antes de M3.
6. **[F3/F18] Dashboard de gasto real-time + alerta al 70/90% del cap + validación de coste al editar `ModelConfig`.** Convierte runaway silencioso en alerta proactiva. — con F18 (analítica).
7. **[F8] Documentar plan de salida de Polar.** ¿Qué pasa si Polar cierra/suspende? Estado de suscripciones recuperable, contrato de exportación de datos de cobro, proveedor MoR alternativo identificado. — riesgo de negocio, documentar antes de lanzar.
8. **[F12] Job nightly de integración real contra sandboxes** (OpenRouter dev-key, Polar sandbox, MinIO/S3 real). Fuera del PR-gate; detecta drift de contrato. — con F12.

## Preguntas sin resolver
- ¿Cuál es el RPO/RTO aceptable para el `CreditLedger`? (define la inversión en backup/HA)
- ¿Grace period del license-guard = minutos, horas, días? (define el riesgo de auto-DoS)
- ¿Storage de prod es MinIO operado o S3 gestionado? (define HA/backup)
- ¿Hay segundo gateway de IA presupuestado o se acepta OpenRouter como SPOF consciente para el MVP?
- ¿Existe contrato/SLA con Polar y plan de salida si suspenden la cuenta?

**Status:** DONE
