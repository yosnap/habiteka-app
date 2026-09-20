# Pivote: planos IA — boceto → plano profesional → imagen cenital

**Rama:** `feat/planos-ia` (desde `develop`) · **Estado:** IMPLEMENTADO, EN VALIDACIÓN DE FIDELIDAD
**Alcance:** prioridad 2D + IA. El editor v2 ya integrado mantiene su vista 3D actual, pero
este plan no abre trabajo nuevo de tour, inmersivo ni vídeo.

## Por qué esta arquitectura (lección del loop anterior)

### Revalidación 2026-09-08

- Dibujo y canvas se conservan sin reinterpretación generativa; dibujo ortogonal → editable offline.
- Fotos se guardan primero; redibujado IA opcional, con original accesible para comparar.
- Resultados, escala y detalles persisten en el proyecto. La cenital puede partir del canvas amueblado.
- El benchmark real detectó alucinaciones en Gemini 2.5 y en el redibujado 3.1: una imagen bonita no acredita fidelidad.
- No se justifica migrar el stack. La puerta pendiente es fidelidad en fotografías/planos variados,
no reconstruir infraestructura. [Resultados y próximos criterios](../reports/260908-estudio-validacion.md).

### Integración de superficie 2026-09-13

- El canvas v2 queda integrado en la rama y se muestra directamente en `/projects/[id]`.
- `/projects/[id]/plano` conserva el flujo IA de boceto → plano técnico → cenital.
- El siguiente hito del pivote sigue siendo validar la fidelidad con entradas reales; la
  integración del canvas no acredita por sí misma la fidelidad de F1–F3.

La explicación siguiente registra la arquitectura histórica; las afirmaciones de fidelidad deben
interpretarse como objetivos, no garantías verificadas para cualquier entrada.

El bloqueo previo venía de pedirle al modelo de imagen que "dibuje el plano" directamente
(texto→imagen): salida no determinista, imposible de iterar. La arquitectura correcta separa:

1. **IA para ENTENDER** — visión → JSON estructurado (geometría del boceto).
2. **Código para DIBUJAR** — renderer vectorial determinista estilo CAD (SVG). Reproducible, testeable.
3. **IA de imagen solo para el ACABADO** — image-to-image condicionado al raster del plano
   (el modelo respeta la disposición porque la recibe como imagen, no como texto).

## Fases

| Fase | Entregable | Estado |
|------|-----------|--------|
| [F1 — Boceto → geometría](phase-01-boceto-a-geometria.md) | Visión OpenRouter → JSON validado (muros, puertas, ventanas, escala) | NÚCLEO HECHO (falta bench con bocetos reales + UI de entrada, ver fase) |
| [F2 — Geometría → plano CAD](phase-02-geometria-a-plano-cad.md) | Renderer SVG determinista: grosores, cotas, símbolos arquitectónicos | HECHO (commit 16ba12f: plan-svg + planoToDoc + diálogo "Plano desde boceto"; falta rasterizado server para F3) |
| [F3 — Plano → imagen cenital](phase-03-plano-a-imagen-cenital.md) | Pipeline image-to-image: raster del plano → render cenital fotorrealista | HECHO (commit d2c06c1; falta bench de fidelidad con planos reales) |

## Hoja de ruta confirmada (Paulo, 2026-07-12)

1. **Plano editable FIEL** (en curso): la conversión redibujado→editor debe ser real y a la
   medida que ponga el usuario, para poder amueblarlo. Afinado de extracción SOLO en el banco
   offline (`tests/canvas/extract-offline.visual.test.ts`) — cero créditos.
2. **Cenital con diseño**: hoy condicionada al redibujado + "detalles del propietario";
   siguiente nivel: condicionarla al plano AMUEBLADO por el usuario en el editor.
3. **Futuro** (no empezar aún): vista/interacción 3D, visitas virtuales y vídeo de navegación
   (candidato: Unreal Engine). Primero asegurar 1 y 2.

## Superficies de proyecto

Paulo no quiere seguir ampliando el workspace legacy ("un montón de mierda por limpiar").
La superficie principal es el **Editor v2** en `/projects/[id]`. El flujo del pivote vive en
el **Estudio de planos** (`PlanoStudio`) en `/projects/[id]/plano`: subir boceto → plano
técnico SVG → vista cenital con estilo. Ambos comparten el mismo proyecto sin redirecciones.

Dependencias: F1 → F2 → F3 (F3 puede empezar en paralelo con F2 usando planos del editor actual como entrada).

## Qué se reutiliza (NO empezar de cero)

- `src/server/ai/` completo: gateway OpenRouter con fallback, providers de imagen (flux, nano-banana), config de modelos en admin, spend-guard, costes.
- `src/server/agent/phases/deteccion-layout.ts`: patrón visión→JSON con schema + validador frontera de confianza. Base directa de F1.
- Editor 2D (Konva) y tipos de `src/canvas/`: el plano generado se materializa como documento editable.
- `entrega.ts` / deliverables (`plano2d`, `render3d`) y persistencia.

## Criterios de aceptación globales

- Un boceto a mano (foto de papel) produce un plano vectorial ortogonal, con cotas, legible como plano técnico.
- El mismo boceto produce el mismo plano (determinismo tras la extracción).
- La imagen cenital respeta la disposición del plano: habitaciones, aberturas y proporciones correctas a simple vista.
- Modelos configurables vía admin (no hardcodear; deuda registrada del pipeline anterior).

## Decisiones confirmadas (Paulo, 2026-07-11)

1. El plano generado desde boceto DEBE quedar editable en el editor 2D.
2. Bench inicial: Gemini vision para extracción; Nano Banana 2 (Gemini image) para la cenital,
   condicionado a que sea el mejor en relación calidad/precio (el bench lo verifica).
3. Entrada de boceto: foto de papel Y dibujo rápido dentro de la app.

## Restricción de producto: UI

La UI actual del editor no es vendible para Paulo; el listón visual es Planner5D. Consecuencia
para este plan: **toda la lógica nueva va desacoplada de los componentes visuales actuales**
(contratos + módulos server + geometría pura), de modo que la capa visual se pueda rehacer
después sin tocar el motor. No invertir en pulir la UI existente más allá de lo mínimo
funcional para probar los pipelines.
