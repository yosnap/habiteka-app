# Red Team — Legal / RGPD / Responsabilidad · Habiteka

> Vector adversarial DPO/abogado. Solo análisis.

## Exposiciones legales

- **[CRÍTICO] Supresión incumplible en subencargados.** Dato ya enviado a OpenRouter (rutea a N proveedores con retención propia) y al proveedor de imagen no se puede "des-enviar". El borrado en cascada de F14 es aspiracional: prometer "cero datos tras supresión" = declaración falsa al interesado. → F14/F3.
- **[CRÍTICO] Transferencia internacional no determinista.** OpenRouter elige proveedor (USA/varios) por request vía `extra_body.models`. SCCs (art. 44+) exigen destino conocido; aquí es variable. Falta info art. 13.1.f en la captura. → F14/F3.
- **[CRÍTICO] Disclaimer ≠ limitación de responsabilidad.** Si un usuario ejecuta reforma sobre un plano con un muro de carga mal detectado → daño. No hay ToS/EULA con limitación de responsabilidad, exclusión de garantías, indemnización. Disclaimer en barra inferior no exonera (Dir. 85/374, Dir. responsabilidad IA, cláusulas abusivas B2C nulas Dir. 93/13). → F1 (solo diseña UX del disclaimer, nadie redacta ToS).
- **[ALTO] Terceros/menores en fotos.** Personas, matrículas, vecinos visibles → sin base legal para no-usuarios. `pii-scrub` solo quita EXIF/geo, no contenido visual. Riesgo art. 8 (menores). → F14/F3.
- **[ALTO] Votación comunitaria sin marco legal.** F9 registra datos de vecinos sin base legal, sin contrato de encargo art. 28 plataforma↔administrador de finca, sin control de edad. El "viral B2C vía fincas" = captación de PII de terceros a escala. → F9.
- **[MEDIO] Logs/analítica + afiliación.** F18 append-only sin TTL → retención indefinida de PII (viola art. 5.1.e). F10 tracking/redirect deja cookies de terceros sin banner de consentimiento (ePrivacy). Append-only choca con art. 17. → F18/F10.
- **[MEDIO] Afiliación disclosure suficiencia** (F10 lo prevé, pero debe ser por producto y en el redirect). · **[MEDIO] fair-code/tying** (F13, teórico sin cuota de mercado).

## Lo que el plan NO cubre

1. ToS/EULA con limitación de responsabilidad (instrumento jurídico real, no el disclaimer UX).
2. Banner/gestión de consentimiento de cookies (ePrivacy) — ausente pese a F10/F18.
3. Detección/anonimización de personas/caras/matrículas (solo EXIF/geo).
4. Verificación de edad / menores (F9, B2C).
5. DPIA art. 35 (tratamiento a escala de imágenes de domicilio + perfilado casi seguro la exige; F14 solo hace RAT art. 30).
6. Distinción "borrado en sistemas propios (garantizado)" vs "best-effort en subencargados".
7. Roles responsable/encargado + contrato art. 28 en flujo comunitario.

## Recomendaciones accionables

1. **[Bloqueante UE]** Crear entregable de ToS (separado de F14): limitación de responsabilidad, exclusión de garantía técnica/estructural, validación profesional como condición contractual, indemnización. Revisión por abogado de consumo.
2. **[Crítico]** Reescribir promesa de supresión de F14: separar garantizado (propio) vs best-effort (subencargados).
3. **[Crítico]** Resolver transferencia OpenRouter: allowlist de modelos por jurisdicción con SCCs, o despliegues UE/zero-retention + opt-out de entrenamiento por contrato. Informar transferencia en captura.
4. **[Alto]** Detección/blurring de personas/caras/matrículas antes de enviar a IA; ampliar `pii-scrub`.
5. **[Alto]** F9: definir roles, contrato art. 28, base legal de vecinos, control de edad.
6. **[Medio]** Banner de cookies (F10/F18); TTL concreto + anonimización de `userId` en `UsageEvent`.
7. **[Medio]** DPIA art. 35 antes de lanzamiento UE.
