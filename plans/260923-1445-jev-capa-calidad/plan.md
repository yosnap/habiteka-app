---
title: "Jev como capa central de calidad y fiabilidad"
status: in-review
mode: deep
created: 2026-09-23
branch: feat/jev-capa-calidad (desde fix/asistente-plano-y-disenos; merge local tras prueba en local, nunca en GitHub)
scope: HOLD SCOPE
---

# Jev como capa central de calidad y fiabilidad

## Resultado buscado
Jev (TypeSafe) evalúa en tiempo real cada análisis y generación de la plataforma y
devuelve un % de fiabilidad que **decide** el siguiente paso: seguir solo, pedir
confirmación o mandar al usuario a corregir (p. ej. el plano en el editor) **antes** de
gastar tokens en diseños, vista 3D, visita virtual o vídeo. Cada evaluación queda
registrada junto a su coste para medir la eficacia de cada generación, gasto y resultado.

## Restricciones
- Jev solo lee texto/JSON (no ve imágenes): se le pasa **evidencia estructurada y medible**
  ya producida por cada pipeline; para imágenes, el veredicto textual del auditor de visión.
- API: `POST https://api.typesafe.ai/v1/systemone`, preguntas `choice`/`score`/`noul`,
  `jev-latest`, 0,042 $/Mtok de entrada; 429/529 con backoff. Preguntas atómicas y en inglés.
- Clave en el panel de admin como proveedor `typesafe` en `ai_provider_credential`
  (cifrada, sin migración para la clave).
- Una evaluación nunca debe costar más de lo que ahorra: una llamada por punto de control,
  con todas las preguntas juntas.
- Documentos ≤ 1000 líneas por fichero; sin `useEffect` directo; textos en español de España.

## Fuera de alcance
- Implementar vídeo/dron (el tipo `VIDEO` no tiene pipeline); la puerta de la fase 4 queda
  preparada para enchufarlo cuando exista.
- Sustituir al auditor de visión: Jev puntúa su veredicto, no mira la imagen.
- **Lienzo legacy** (`generateDesignFromCanvas`): queda EXCLUIDO de la puerta previa. Es un
  flujo en retirada y no produce un documento estructurado que Jev pueda juzgar (no hay muros,
  huecos ni escala que medir), así que una puerta ahí daría un veredicto inventado. Todo lo que
  lo sustituye —editor v2 y estudio del plano— sí pasa por la puerta.

## Alcance cubierto por las puertas previas (generaciones de pago)
- Editor v2: diseño, propuesta editable, render de concepto y vista 3D (`editor_structure`).
- Instrucciones de cambio: «pedir cambios» y `/api/iterations` (`change_instruction`).
- **Vistas cenitales**: `cenitalStudio` del estudio y las acciones `generateCenitalFromPlano` /
  `generateCenitalFromRedrawn`, con el veredicto `plan_extraction` guardado en el estado del
  estudio (leído en servidor); sin veredicto se evalúa en el momento con la extracción cruda y,
  sin evidencia ninguna, se falla en cerrado pidiendo confirmación.

## Fases
| # | Fase | Estado | Depende de |
|---|------|--------|-----------|
| 1 | [Núcleo Jev: cliente, credencial en admin y registro de evaluaciones](phase-01-nucleo-jev.md) | completed | — |
| 2 | [Puerta de fiabilidad del plano (estudio y asistente)](phase-02-fiabilidad-plano.md) | completed | 1 |
| 3 | [Asistente por intención: diseño vs convertir plano](phase-03-asistente-intencion.md) | completed | 2 |
| 4 | [Puerta previa a generar desde el editor (render, 3D, recorrido)](phase-04-puerta-editor.md) | completed | 1 |
| 5 | [Evaluación posterior y pre-chequeo de instrucciones](phase-05-calidad-resultados.md) | completed | 1 |
| 6 | [Panel de eficacia: calidad × coste](phase-06-panel-eficacia.md) | completed | 1, 5 |
| 7 | [Vistas realistas desde el plano y detección plano/foto](phase-07-vistas-realistas.md) | completed | 2, 3, 4 |
| 8 | [Zonas permitidas garantizadas y alzados sin muro delantero](phase-08-zonas-y-alzados.md) | in-review (falta prueba en navegador) | 7 |

Modo deep: las fases 1–3 están detalladas; 4–6 se escoutean y detallan al empezarlas.

## Criterios de aceptación globales
- Con la clave configurada, cada punto de control cubierto registra una evaluación
  (checkpoint, score 0–100, decisión, confianza, coste de Jev, referencia al diseño o plano).
- Un plano con fiabilidad por debajo del umbral **no** dispara generaciones de pago y el
  usuario ve por qué y un botón que le lleva al editor a corregirlo.
- El admin ajusta umbrales sin desplegar y ve tasa de aprobación, coste por resultado
  aceptado y gasto desperdiciado por punto de control y modelo.
- Sin clave o con Jev caído, la plataforma sigue funcionando según la política elegida
  (ver preguntas abiertas) y lo registra.

## Decisiones validadas (2026-09-23, Paulo)
1. Bandas: **≥85 % sigue solo; 60–85 % muestra motivos y pide confirmar; <60 % bloquea y
   manda al editor.** Valores por defecto de `quality_thresholds`, ajustables en el admin.
2. Jev caído o sin clave: **fail-closed para lo caro** — las generaciones de pago esperan o
   exigen confirmación expresa del usuario; el fallo se registra (`failOpen=false`).
3. Coste de Jev: **lo absorbe la plataforma**; se registra y se ve en el panel de eficacia.
4. `fix/asistente-plano-y-disenos` se prueba primero en local; la rama de Jev parte de develop
   cuando esa rama esté mergeada.
