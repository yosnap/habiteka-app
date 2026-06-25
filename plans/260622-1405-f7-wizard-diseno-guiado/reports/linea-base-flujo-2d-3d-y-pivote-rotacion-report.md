# F7.1 — Línea base del flujo 2D↔3D y diagnóstico del pivote de rotación

**Fecha:** 2026-06-22 · **Rama:** `feat/canvas/f6-3d-navegable` · **Fase:** F7.1 (verificación base)

## Objetivo
Establecer, de forma REPRODUCIBLE, qué respeta hoy el flujo 2D→3D antes de añadir Draw Walls,
y exponer el bug de pivote de rotación que el red-team marcó como Critical (#1).

## Método
Test puro `tests/canvas/3d/pivot-2d-3d-alignment.test.ts` (4 tests, verde). Compara:
- **Centro 2D real (Konva):** rota `(w/2, h/2)` sobre la ESQUINA `(x,y)` — como pinta el
  `<Group>` de `structure-layer.tsx:82-89` (sin `offsetX/offsetY`).
- **Centro asumido por 3D (`docToScene`):** `(x + w/2, y + h/2)` SIN rotar — `planPointToXZ`
  (`doc-to-scene.ts:184-186`).

Se eligió test puro sobre seed+navegador porque demuestra el desfase de forma exacta,
reproducible y como regresión, sin contaminar la BD dev compartida (red-team #7) ni depender de
automatización de canvas frágil (red-team #11). La comparación VISUAL antes/después se hará en la
fase 2, cuando se corrija el pivote (ahí la captura aporta).

## Resultado

| Caso | 2D (Konva, esquina) | 3D asume (`docToScene`, AABB) | Desfase |
|---|---|---|---|
| Muro 300×15 a **0°** | (350, 207.5) | (350, 207.5) | **0** ✅ |
| Muro 300×15 a **90°** | (192.5, 350) | (350, 207.5) | **~200 px ≈ 2 m** ❌ |

## Conclusiones (línea base)
- **POSICIÓN 2D↔3D coincide SOLO con `rotation=0`.** Todo el contenido actual (examples.ts, seed)
  es rotation=0, por eso F6 se verificó verde y el bug quedó latente.
- **Con `rotation≠0` el objeto se desplaza ~2 m en 3D.** Draw Walls (fase 2) crea muros rotados
  (ángulo del segmento), así que SIN corregir el pivote, una sala dibujada a mano saldría
  descuadrada/abierta en 3D. Es el prerrequisito bloqueante del núcleo de F7.
- **Qué SÍ está bien (no tocar):** la conversión px→m, el mapeo de ejes Y-2D→Z-3D, la separación
  walls/furniture/lights, y la posición de objetos axis-aligned. El problema es ÚNICAMENTE el pivote
  de rotación.

## Qué falta (confirmado, para fases siguientes)
- **Pivote (fase 2):** alinear el origen de rotación 2D/3D. Decisión: o `segmentToWall` produce
  geometría coherente con el centro-AABB de `docToScene`, o se corrige `docToScene`/`structure-layer`
  para usar el mismo origen. El test de esta fase pasará a exigir desfase ~0 tras la corrección.
- **Orientación de muebles (fase 6):** el 3D solo aplica `rotationY`; sin "frente"/anclaje.
- **Modelos (fase 7):** `lampara.glb` es el modelo Lantern (farola) renombrado.

## Verificación
- `bunx vitest run tests/canvas/3d/`: 44 verdes (incl. los 4 nuevos del pivote).
- `bunx tsc --noEmit` + `bunx eslint`: limpios.

## Preguntas abiertas
- Ninguna. El siguiente paso (fase 2) parte de un diagnóstico cuantificado, no de suposiciones.
