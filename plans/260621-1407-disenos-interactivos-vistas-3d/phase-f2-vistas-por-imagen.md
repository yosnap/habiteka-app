# F2 · Tipos de vista por imagen

**Estado: ❌ CERRADA NO-GO (por evidencia del prototipo).** Las vistas no cenitales por imagen
no son viables con modelo de imagen 2D (3 modelos probados, mismo fallo). La necesidad de vistas
navegables se redirige a **F6 (3D real, Three.js/R3F)**. Ver `docs/spikes/vistas-por-angulo/decision.md`.
Rama: `feat/canvas/f2-vistas-por-imagen`.

## Resultado del prototipo (gate)

El paso 1 (prototipo de fidelidad) se ejecutó en 3 iteraciones (Nano Banana, +caso coherente,
Gemini 3 Pro). Veredicto: **cenital GO** (y con tamaños correctos), **resto NO-GO** — el modelo de
imagen no puede reconstruir otra cámara desde una referencia 2D cenital (límite del enfoque, no del
proveedor). Los pasos 2–6 NO se implementan. Ganancias conservadas: render cenital con tamaños
correctos, EXAMPLE_SALON coherente, provider con modelo inyectable, arnés multi-modelo.

**Etapa C (vistas). Valor alto.** El usuario elige el ÁNGULO de la vista del render:
cenital, desde la puerta, panorámica interior, ojo de pájaro. Son llamadas a `image.generate`
con el prompt adaptado al ángulo (NO es 3D navegable; eso es F6).

## Decisiones tomadas con el usuario

1. **`viewType` es POR RENDER, no por proyecto.** El usuario puede generar VARIAS vistas del mismo
   diseño (galería). El `viewType` vive en el payload de cada `render3d`, no en `Collected`.
2. **Prototipo de fidelidad PRIMERO** (gate del roadmap). El arnés lo preparo yo; **lo ejecuta el
   usuario** con sus claves (`OPENROUTER_API_KEY` + `RUN_SPIKE=true`); yo no tengo dev-keys.
3. **Eje de vistas declarativo y escalable** en `src/lib/design-options.ts` (fuente única, mismo
   patrón que `ESTILOS`/`ENTREGABLES`; el compilador obliga a etiquetar cada `ViewType`).

## Incógnita crítica (gate GO/NO-GO)

¿El modelo de imagen respeta las posiciones del plano desde ángulos NO cenitales (desde la
puerta, panorámica)? El `referenceImage` cenital da la disposición, pero el prompt pide otra
cámara. **Si la fidelidad cae demasiado, F2 se limita a las vistas que sí funcionan** (o NO-GO
para los ángulos malos). Se decide con evidencia visual del spike, no a priori.

---

## Paso 1 · Prototipo de fidelidad por ángulo  (PENDIENTE — lo corre el usuario)

- Crear `tests/spikes/vistas-por-angulo.spike.ts` (script `tsx` manual, NO vitest — gasta
  créditos), siguiendo el patrón de `lienzo-a-render-referenceimage.spike.ts`.
- Genera, para el MISMO doc de ejemplo (`EXAMPLE_SALON`) con su `referenceImage` cenital, un
  render por cada `viewType` (cenital de control + desde-puerta + panorámica + ojo-de-pájaro),
  variando SOLO la instrucción de cámara del prompt.
- Vuelca los PNG a `tests/spikes/out-vista-<viewType>.png` + la referencia.
- **Decisión documentada** en `docs/spikes/vistas-por-angulo/decision.md`: por cada ángulo,
  ¿respeta posiciones? GO/NO-GO por ángulo. (Reusa el espíritu de `docs/spikes/calidad-ia`.)
- **Bloqueante:** sin esta evidencia NO se implementan los pasos 2–6 para los ángulos no validados.

## Paso 2 · Eje `ViewType` en la fuente única  (tras GO)

- `src/lib/design-options.ts`: `ViewType` + `VISTAS: Record<ViewType,string>` derivado a array,
  análogo a `ESTILOS`. El *tipo* `ViewType` puede vivir en `contracts/` si se comparte.
- TDD: test que afirme que el array derivado == los valores del tipo (sin olvidos), como F1b.

## Paso 3 · Contrato: `viewType` en el payload `render3d`

- `src/lib/contracts/deliverable.ts`: `{ type:'render3d'; assetUrl:string; viewType?: ViewType }`
  (aditivo y opcional → no rompe renders existentes; JSONB no necesita migración).
- `image-adapter.ts` (`ImageGenRequest`): NO añadir viewType al adaptador; el ángulo se traduce a
  TEXTO en el prompt (el proveedor solo entiende prompt+referencia). El viewType es del dominio.

## Paso 4 · Prompt adaptado al ángulo

- `src/server/agent/phases/entrega.ts` `renderPrompt(input)`: anteponer la instrucción de cámara
  según `input` (p. ej. "Vista desde la puerta, a la altura de los ojos, mirando al interior…").
  El `sketch.description` (de `serialize-doc-to-prompt`) sigue dando la disposición.
- Mapear cada `ViewType` → frase de cámara en un solo sitio (helper declarativo).

## Paso 5 · Selección de vista en UI y chat

- Formulario: `src/components/canvas/generate-from-canvas-dialog.tsx` — añadir selector de vista
  (de `VISTAS`). La Server Action `agent-actions.ts#generateDesignFromCanvas` propaga `viewType`;
  `orchestrator.ts#handleGenerateFromCanvas` lo lleva al `ReadyForDelivery`.
- Chat: `qualification-tools.ts` + `phases/cualificacion.ts` — herramienta `set_vista` (enum de
  `VISTAS`), análoga a `set_estilo`.

## Paso 6 · Galería: varias vistas del mismo diseño

- `src/app/(app)/projects/[id]/deliverables/page.tsx` — confirmar que lista múltiples `render3d`
  y mostrar el `viewType` de cada uno (etiqueta). Es lo que habilita la "galería de vistas".

## TDD / Validación

- TDD para piezas PURAS: derivación de `VISTAS` (paso 2), mapeo viewType→frase de cámara (paso 4),
  round-trip del payload con `viewType` (paso 3). NO para la fidelidad del render (es visual → spike).
- Regresión: un `render3d` SIN viewType sigue válido (cenital por defecto); el prompt sin vista
  específica = comportamiento actual.
- Tests focales `tests/canvas/` + `tests/lib/` + tests del agente afectados (NO suite completa:
  vacía la BD de dev — memoria `tests-comparten-bd-dev`).

## Riesgos y rollback

- **Fidelidad por ángulo (alto):** mitigado por el gate del spike. NO-GO honesto por ángulo.
- **Contrato render3d:** `viewType` aditivo y opcional → rollback = ignorarlo (renders viejos
  siguen deserializando).
- **Coste:** cada vista = una llamada de imagen pagada. La galería multiplica coste → el usuario
  decide cuántas vistas genera (no se generan todas automáticamente).

## Fuera de alcance (anotado)

- 3D navegable en tiempo real (Three.js/R3F) → F6, plan aparte.
- Vídeo de la vista → F-LUZ / futuro.
- Mejorar el realismo del prompt más allá del ángulo → tarea transversal "Realismo".

## Checklist de entrega

- [x] Paso 1 — arnés del spike + 3 iteraciones ejecutadas → decisión **NO-GO** para ángulos no cenitales.
- [~] Pasos 2–6 — DESCARTADOS por el gate. La vista navegable se aborda en F6 (3D real).
- [x] Ganancias conservadas — render cenital con tamaños (escala F0→prompt), EXAMPLE_SALON coherente,
      provider con modelo inyectable, arnés multi-modelo. Verificado: typecheck, eslint, tests.
