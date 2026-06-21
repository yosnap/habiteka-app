# F0 · Escala arquitectónica en el plano

**Etapa A (mapeo). Fundacional.** Veredicto /ck:predict: CAUTION → GO con los gates 1 y 3 implementados tal cual.

## Objetivo

El plano deja de ser píxeles abstractos: el usuario fija una escala real y cada objeto
adquiere medidas (cm/m). La IA recibe medidas reales en el prompt → mejor fidelidad y base
para decoración/materiales (F5b) y detección métrica (F5).

## Decisiones de diseño (fijadas por /ck:predict)

- **Fuente de verdad de conversión = `pxPerMeter`** (px de stage por metro real). El ratio
  arquitectónico (1:50) es metadato PRESENTACIONAL opcional, NO autoritativo, para no
  desincronizar dos fuentes de verdad.
- **Almacenamiento canónico en METROS.** El formateo cm/m vive en presentación (toolbar, prompt).
- **Campo aditivo y opcional:** `scale?: CanvasScale`. NO se sube `CANVAS_SCHEMA_VERSION`
  (un doc v1 sin `scale` = escala desconocida/abstracta, sigue válido). Migración no destructiva.
- **`serialize-doc-to-prompt` degrada con gracia:** sin `scale` → salida byte-idéntica a hoy
  (protege CRL-4). Las medidas reales son aditivas y condicionadas a `scale` presente.
- **Calibración mínima en v1:** input directo de una dimensión conocida ("el ancho de esta sala
  es X m") que deriva `pxPerMeter`, + selector de ratio. La **regla interactiva sobre el stage**
  (arrastrar "esto es 1 m") se DIFIERE a sub-fase futura (anotada en "Fuera de alcance").

## Modelo de datos

```ts
// src/canvas/types.ts
export interface CanvasScale {
  /** Px de stage equivalentes a 1 metro real. Fuente de verdad de la conversión. */
  pxPerMeter: number;
  /** Ratio arquitectónico presentacional (50 = "1:50"). Metadato, no autoritativo. */
  ratio?: number;
}
// CanvasDoc gana: scale?: CanvasScale;  (CANVAS_SCHEMA_VERSION NO cambia)
```

## Archivos a crear

- `src/canvas/scale.ts` — lógica pura (sin Konva/React):
  - `pxToMeters(px, scale): number`
  - `metersToPx(m, scale): number`
  - `formatLength(meters): string` — elige cm/m y redondea amable (cm enteros).
  - `isValidScale(v): v is CanvasScale` — `pxPerMeter > 0 && Number.isFinite`.
  - `deriveScaleFromKnownLength(px, meters): CanvasScale | null` — calibración por dimensión conocida.
- `tests/canvas/scale.test.ts` — TDD primero. Cubre conversión, redondeo, `pxPerMeter` inválido
  (0, negativo, NaN, Infinity) → sin conversión; ida y vuelta px→m→px.

## Archivos a modificar

- `src/canvas/types.ts` — añadir `CanvasScale` y `scale?` a `CanvasDoc`. `emptyCanvasDoc` deja
  `scale` ausente (sin escala por defecto).
- `src/canvas/serialize.ts` — `serializeCanvas` incluye `scale` si está; `deserializeCanvas`
  parsea `scale` defensivamente (`parseScale`: si malformado o `pxPerMeter<=0` → omitir).
- `src/canvas/canvas-store.ts` — acción `setScale(scale: CanvasScale | null)` (entra en historial;
  análoga a `setBaseImage`).
- `src/canvas/serialize-doc-to-prompt.ts` — si `doc.scale`: añadir medidas reales a la
  descripción de la sala ("la sala mide ≈ A×B m") y de cada elemento ("puerta de 90 cm").
  Sin `scale`: salida idéntica a hoy.
- `src/components/canvas/canvas-toolbar.tsx` — (a) selector de escala / calibración simple;
  (b) al seleccionar objeto con escala activa, mostrar dimensiones reales junto a las de px.

## TDD / Validación

1. **Primero** `tests/canvas/scale.test.ts` (lógica pura) — debe fallar, luego pasar.
2. **Regresión** en `tests/canvas/serialize-doc-to-prompt.test.ts`: caso SIN escala = texto
   actual intacto; caso CON escala = incluye medidas reales.
3. **Regresión** en `tests/canvas/serialize.test.ts`: round-trip de `scale` (válido se
   conserva; malformado se descarta).
4. Typecheck + eslint. Tests focales en `tests/canvas/` (no la suite completa, que vacía la BD
   de dev — ver memoria `tests-comparten-bd-dev`).

## Riesgos y rollback

- **Modelo `scale` persistido**: mitigado por `pxPerMeter` única fuente + parser defensivo.
- **Romper CRL-4 (prompt)**: mitigado por degradación con gracia + test de regresión del texto.
- Rollback: el campo es aditivo y opcional; revertir = quitar `scale` (docs guardados siguen
  deserializando como v1 sin escala).

## Fuera de alcance (anotado)

- Regla interactiva de calibración sobre el stage (arrastrar "esto es 1 m") → sub-fase futura.
- Multi-unidad configurable (pulgadas, etc.) — internamente solo metros.
- Cantidades derivadas (m² de suelo, ml de rodapié) → corresponden a F5b (materiales).
- Altura de techo 3D / volumen → fuera de F0 (es 2D en planta).
