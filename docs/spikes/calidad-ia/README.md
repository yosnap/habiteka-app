# Spike F-S0 — Validación de calidad del entregable IA (GATE GO/NO-GO)

Valida **empíricamente** que la calidad del output de IA (render 3D, plano 2D,
inpainting y detección de visión sobre boceto) es suficiente para que un usuario
objetivo pague — **antes** de dar por bueno el resto del producto. Cierra la
decisión §9.1 (proveedor de imagen) con datos, no con intuición.

> **Es un spike, no producción.** Su entregable es una **decisión documentada**
> (`decision.md`: GO/NO-GO + proveedor elegido), no features. El código del arnés
> vive en `tests/spikes/**` y no entra en el flujo de usuario.

## Estado de la infraestructura (importante)

Hoy en `src/server/ai/image/` **solo FLUX está implementado**. `nano-banana` e
`imagen` son **stubs** que fallan a propósito si se seleccionan
(`providers/stubs.ts`). Consecuencias para este spike:

- Se puede ejecutar el comparativo **completo solo con FLUX** ya mismo.
- Para comparar los **tres** proveedores (como pide el plan), antes hay que
  implementar los providers de Nano Banana e Imagen (cada uno: una clase
  `ImageProvider` con `generate`/`inpaint` real). Mientras no existan, el arnés los
  marca como "no disponibles" en la tabla en vez de fingir datos.

## Cómo ejecutar

1. **Pon las claves reales** en `.env.local` (nunca se commitean):
   ```
   IMAGE_PROVIDER=flux
   IMAGE_PROVIDER_KEY=<tu-key-de-flux>
   OPENROUTER_API_KEY=<tu-key-openrouter>   # para la detección de visión
   # Activa el arnés (por defecto está desactivado para no llamar a IA en tests):
   RUN_SPIKE=true
   ```

2. **Prepara las entradas** en `inputs/` (ver `inputs/README.md`): 15–20 bocetos a
   mano + fotos reales representativas, **anonimizadas** (sin EXIF/geo/caras).

3. **Lanza el arnés** (un proveedor por ejecución; cambia `IMAGE_PROVIDER` y repite):
   ```bash
   bun run spike:calidad
   ```
   Vuelca los outputs a `samples/<proveedor>/` y registra coste/latencia en
   `samples/<proveedor>/run.json`.

4. **Mide la detección de visión**:
   ```bash
   RUN_SPIKE=true bun run test tests/spikes/vision-detection-accuracy.test.ts
   ```
   Reporta la tasa de acierto contra el ground-truth anotado en `inputs/`.

5. **Evalúa** con `rubric.md` (criterios objetivos) + una **sesión con usuarios
   objetivo** (¿pagarían por esto?). Vuelca a `user-eval-results.md`.

6. **Decide** en `decision.md`: tabla por candidato + proveedor elegido (§9.1) +
   **GO/NO-GO por evidencia** contra el umbral de `rubric.md`.

## Protocolo de evaluación

- Mismas entradas contra cada candidato (comparación de igual a igual).
- La decisión pondera **calidad Y coste/latencia**, no calidad sola.
- Entradas reales (bocetos a mano, fotos reales), no prompts sintéticos ideales.
- NO-GO honesto si ningún proveedor alcanza el umbral: detener M2 y replantear
  (proveedor / pricing / segmento), no construir a ciegas.

## Privacidad

Las fotos de entrada se **anonimizan** antes de enviarse a proveedores (EXIF/geo
fuera + caras difuminadas), con el mismo criterio que `pii-scrub` de F14. Si una
muestra revela domicilio o personas, se **excluye** del repo.

## Seguridad

Las dev-keys viven **solo** en `.env.local` (gitignored), nunca en CI ni en el
cliente. El arnés está **desactivado por defecto** (`RUN_SPIKE` no definido): así
ningún `bun test` ni el CI dispara llamadas reales a IA por accidente.
