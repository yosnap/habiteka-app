---
handoff-version: 1
generated: 2026-09-26T13:34:12+02:00
generator: ak:handoff
focus: "Continuar Habiteka en una nueva sesión: mejorar calidad del plano 2D y del 3D, aplicar y aprobar diseños antes de la visita, y avanzar luego al vídeo; dejar el pulido general de UX para el final."
workspace: /Volumes/EVO990/Proyectos/CodeIA Academy Projects/habiteka/habiteka-app
branch: develop
head: c649192a100de630ad7c939287135c42aaff2b05
---

# HANDOFF: calidad visual y diseño aprobado antes de la visita

## Mission and current status

Focus: "Continuar Habiteka en una nueva sesión: mejorar calidad del plano 2D y del 3D, aplicar y aprobar diseños antes de la visita, y avanzar luego al vídeo; dejar el pulido general de UX para el final."

Done: el Editor v2 tiene plano 2D editable, maqueta cenital y vista 3D de un mismo `EditorDocument`; la muestra aislada permite visita libre, recorrido entre dos plantas y exportación MP4 nativa. La propuesta nativa de diseño aplica acabados y muebles al documento con deshacer. El último commit añade selección de suelos por planta.

Remaining: elevar el acabado de la maqueta y de la planta visual; fijar un diseño elegido como versión aprobada e inmutable; hacer que visita y vídeo carguen esa versión, no la revisión editable; validar un inmueble importado fiel. La fidelidad métrica de fase 2 sigue abierta. Prioridad nueva del usuario: calidad visual y flujo diseño aplicado → visita; pulido general de UX después.

## Scope and guardrails

Workspace: `/Volumes/EVO990/Proyectos/CodeIA Academy Projects/habiteka/habiteka-app`.

In scope: fases 2–5 del plan integral, empezando por la fase 3 visual y el contrato de aprobación. Mostrar un plano visual cenital con los mismos objetos, posiciones, acabados e iluminación de la escena 3D; preservar el plano técnico para editar medidas, muros y huecos. Mejorar el 3D en maqueta e interior; conectar el diseño aceptado con visita y, después, vídeo.

Out of scope inmediato: pulido general de UX, vídeo generativo y catálogo de una tienda sin acuerdo. No declarar fotorrealismo ni exactitud de SKU sin medirlos.

Constraints: hablar siempre en español; mantener archivos de código por debajo de 1000 líneas salvo necesidad justificada; editar con parches; usar una escena y un documento coherentes; no usar planos del proyecto real como banco de pruebas ni modificar datos reales. Para validación visual usar `/dev/editor-v2?muestra=visual` y `/dev/editor-v2?muestra=plantas`.

Safety boundaries: no aplicar ni regenerar automáticamente el plano del proyecto `cmug4og03008sjmms878cxwn3`; no gastar créditos externos ni publicar una visita/vídeo desde geometría sin revisión. Conservar los archivos ajenos sin seguimiento del árbol de trabajo.

## Current state

Branch: `develop`.

HEAD: `c649192a100de630ad7c939287135c42aaff2b05` (`feat(editor-v2): seleccionar suelos de la planta en bloque`).

Working tree: sin cambios en archivos rastreados al inicio de este traspaso; hay archivos sin seguimiento.

Changed files: ninguno rastreado; este documento es el único archivo creado en esta sesión.

Untracked files: `.skill-map/`, `plans/reports/debugger-260925-1755-cotas-discordantes.md`, `plans/reports/eval-260925-1735-downscale-vision.md`, y este handoff. Los tres primeros ya existían y no se tocaron.

Intentional local modifications: sí, solo este handoff; la procedencia de los otros archivos sin seguimiento no se capturó.

## Decisions and rationale

| Decisión | Motivo | Alternativa descartada | Referencia |
| --- | --- | --- | --- |
| Mantener `EditorDocument` y Three/R3F como fuente común del aspecto visual y de la visita | Evita diferencias de distribución, muebles y materiales entre cámaras | Crear un plano 2D decorado independiente o coser renders IA como geometría | PRD §3–4; plan integral, «Arquitectura común» y «Dirección visual» |
| Conservar el dibujo Konva para edición precisa y añadir/elevar la presentación cenital desde la escena compartida | El 2D actual usa símbolos planos; el usuario quiere ver allí la calidad de la maqueta sin perder selección/cotas | Sustituir sin más el lienzo técnico por una imagen raster | `document-layer.tsx`, `furniture-symbol.tsx`, `editor-scene-view.tsx` |
| Mejorar primero modelos, materiales, luces y encuadres medibles en muestra aislada | La fase 3 documenta mobiliario provisional y acabado irregular | Cambiar de motor o modelo de IA por intuición | Fase 3, «Inicio de la vista cenital» |
| Separar «aplicar una propuesta» de «aprobar una versión» | `applyNativeDesignProposal` modifica el borrador; la visita actual toma el documento editable. La aprobación inmutable aún está pendiente | Tratar una imagen elegida o un `store.apply` como aprobación persistente | Fase 3, trabajo 1–3 y 12; `editor-shell.tsx` |
| Enlazar visita y vídeo a una revisión aprobada tras la revisión visual | Lo pide el usuario y lo exige el PRD para reproducibilidad | Pasear o publicar sobre una revisión mutable | PRD §4; fases 4 y 5 |

## Work performed

- Se leyó el PRD, el plan integral y las fases 2–5, además del handoff anterior y el esquema del handoff.
- Se verificaron rama, HEAD y estado del árbol. No se modificó código ni base de datos.
- Se inspeccionó el vínculo de la propuesta nativa con el editor: `editor-shell.tsx` llama a `applyNativeDesignProposal` y `state.apply(next)`; se inspeccionó la escena R3F y los símbolos 2D. El código de `EditorSceneView` recibe el `store` editable; no se observó en ese flujo una carga de snapshot aprobado.
- Se ejecutaron dos archivos de pruebas concretos: 12 pruebas satisfactorias.
- Se creó este documento de continuación. 0 redactions applied.

## Verification

| Check | Command | Outcome | When |
| --- | --- | --- | --- |
| Rama y estado | `git rev-parse --is-inside-work-tree`, `git rev-parse --show-toplevel`, `git branch --show-current`, `git rev-parse HEAD`, `git status --short` | Repositorio correcto, `develop`, HEAD indicado, sin modificaciones rastreadas al inicio | 26-09-2026, esta sesión |
| Aplicación de propuesta y proyección a escena | `bun test tests/editor-document/native-design-proposal.test.ts tests/canvas/editor-v2-scene.test.ts` | 12 pass, 0 fail | 26-09-2026, esta sesión |

Not run:

- `bun run typecheck`, build y pruebas completas: solo se añadió documentación; repetir tras cambios de implementación.
- Prueba visual en navegador o con un plano real: esta sesión preparó el traspaso y no alteró proyecto alguno. Las comprobaciones visuales previas de la muestra constan en las fases 3–5, pero no verifican este nuevo objetivo ni certifican un inmueble importado.

## Open risks and blockers

- Type: risk. Owner: equipo de producto/desarrollo. Impact: el 2D técnico usa Konva y símbolos de mobiliario, mientras el 3D usa Three/R3F y GLB; una capa visual nueva puede divergir si se implementa como segundo modelo o tapa los controles de edición.
- Type: risk. Owner: equipo de producto/desarrollo. Impact: el diseño aplicable existe, pero falta una aprobación persistente que fije documento y versiones de activos; una visita actual puede cambiar al editar el borrador.
- Type: blocker para publicación fiel. Owner: revisión humana de plano y desarrollo. Impact: la fase 2 mantiene discrepancias de cotas/topología en planos importados; no aprobar ni publicar esos casos hasta resolverlas.
- Type: question. Owner: responsable de producto. Impact: falta escoger un inmueble patrón y fotografías/cámaras de referencia para medir el salto de calidad; mientras tanto, avanzar sobre la muestra aislada con criterios comparables de cenital, oblicua e interior.
- Type: risk. Owner: desarrollo. Impact: materiales y modelos GLB provisionales, en especial baño/sanitarios, pueden impedir la calidad deseada; sombras, carga y FPS han de medirse antes de subir resolución o complejidad.

## Exact next actions

1. **First safe step** — leer este handoff, el PRD, el plan integral y las fases 2–5; comprobar `git status`, los commits y las pruebas pertinentes antes de cambiar código. Preservar los tres archivos sin seguimiento ajenos.
2. En `/dev/editor-v2?muestra=visual`, capturar la misma planta en 2D técnico, cenital, oblicua e interiores con una iluminación fija. Inventariar diferencias de materiales, muebles, puertas, ventanas y escala; elegir un lote pequeño de mejoras de alto impacto y medir carga/FPS. No tocar el proyecto real.
3. Mejorar la escena compartida: reemplazar primero volúmenes provisionales dominantes por modelos licenciados y medidos; ajustar materiales PBR, luz/sombras y encuadres. Repetir capturas comparables de día/tarde. Mantener mobiliario y geometría ligados al `EditorDocument`.
4. Dar al plano una presentación cenital amueblada que corresponda a esa escena (misma planta, objetos, escala y acabados), alternable con el lienzo técnico editable. Verificar que editar una pared, abertura, suelo o mueble se refleje inmediatamente en ambas vistas y que las herramientas 2D sigan utilizables.
5. Completar elección/aplicación del diseño y aprobación versionada de la fase 3: vista previa de diferencias, confirmación explícita, validaciones, snapshot del documento y activos; posteriores cambios abren borrador. Usar una muestra aislada y pruebas de no mutación de la versión aprobada.
6. Abrir la visita de la fase 4 desde esa versión aprobada, con materiales, muebles e iluminación iguales a la cenital; probar estancias, puertas y paso entre plantas. Después enlazar el montaje MP4 nativo de fase 5 a la misma revisión, antes de invertir en vídeo IA.
7. Volver al pulido general de UX cuando el circuito visual y la fidelidad de la versión estén demostrados; continuar en paralelo la evaluación aislada de la importación de fase 2, sin desbloquear la publicación de planos dudosos.

## Source pointers

- `docs/prd-inmueble-verificable-inmersion-video-catalogo.md`
- `plans/260924-1459-flujo-integral-plano-diseno-inmersion-video/plan.md`
- `plans/260924-1459-flujo-integral-plano-diseno-inmersion-video/phase-02-importacion-y-edicion.md`
- `plans/260924-1459-flujo-integral-plano-diseno-inmersion-video/phase-03-diseno-aprobado.md`
- `plans/260924-1459-flujo-integral-plano-diseno-inmersion-video/phase-04-visita-inmersiva.md`
- `plans/260924-1459-flujo-integral-plano-diseno-inmersion-video/phase-05-video-construccion-y-recorrido.md`
- `plans/reports/handoff-20260925-0027-editor-visual-e-inmersion.md` (histórico; su estado de implementación está desactualizado)
- `src/components/editor-v2/document-layer.tsx`, `src/components/editor-v2/furniture-symbol.tsx`, `src/components/editor-v2/canvas-view.tsx`
- `src/components/editor-v2/scene/editor-scene-view.tsx`, `src/components/editor-v2/scene/furniture-model.tsx`, `src/components/editor-v2/scene/scene-lighting.tsx`
- `src/components/editor-v2/editor-shell.tsx`, `src/lib/editor-document/native-design-proposal.ts`, `src/server/editor/document-repo.ts`
- `tests/editor-document/native-design-proposal.test.ts`, `tests/canvas/editor-v2-scene.test.ts`
