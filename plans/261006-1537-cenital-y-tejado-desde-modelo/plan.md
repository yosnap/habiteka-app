---
title: "Cenital fiable y tejado desde el modelo"
description: "Recupera la cenital del Estudio de diseño y cierra la cubierta de las vistas aceptadas desde el modelo, sin diseñarla con IA"
status: in-progress
priority: P1
effort: "10h"
tags: [estudio-diseno, render, cubierta, video]
created: 2026-10-06
---

# Cenital fiable y tejado desde el modelo

## Resumen

El 06/10 la cenital dejó de generarse bien: el prompt v4 (21 444 caracteres de JSON) tumba las rutas KIE, y Gemini reinventa la distribución. Además, la generación omite muebles, ignora el modo Controlado y pierde imágenes pagadas si falla la revisión. Diagnóstico: `plans/reports/diagnostico-261006-1726-generacion-imagenes-cenital-y-cubiertas.md`.

Decisión con Paulo: el tejado no se diseña con IA. Sale del modelo: una maqueta vista desde la cámara de la isométrica o el dron aceptados guía a la IA, que añade la cubierta a esa imagen, y una revisión propia comprueba el resultado. El primer enfoque (proyectar la cubierta y retocar solo dentro de su máscara) se descartó porque el generador reencuadra las vistas lejanas. El resultado necesita aceptación del usuario y sirve al vídeo de construcción como referencia con tejado.

## Objetivos

| # | Objetivo | Prioridad |
|---|------|----------|
| 1 | Prompt de cenital corto (menos de 5000 caracteres) que nombre exterior, vehículos, sanitarios y muebles clave | P1 |
| 2 | Estricto, Controlado y Libre distintos en la cenital | P1 |
| 3 | Ninguna imagen pagada se pierde por un fallo de la revisión visual | P1 |
| 4 | «Cerrar tejado desde el modelo» sobre isométrica o dron aceptados, guiado por la maqueta del modelo y revisado | P1 |
| 5 | El vídeo de construcción acepta esa imagen como referencia con tejado | P2 |

## Fases

| # | Fase | Estado |
|---|-------|--------|
| 1 | [Cenital fiable](./phase-01-cenital-fiable.md) | Completada |
| 2 | [Cerrar tejado desde el modelo](./phase-02-cerrar-tejado-desde-modelo.md) | Completada |
| 3 | [Prueba real en local](./phase-03-prueba-real.md) | Cenital probada; cierre de tejado (edición guiada) pendiente de una isométrica aceptada (Test 6 sin ortofoto) |

## Restricciones

- Las normas de AGENTS.md: los resultados finales parten de diseños IA aceptados, el 3D es solo una guía, la documentación se actualiza en el mismo cambio y ningún fichero pasa de 1000 líneas.
- No forzar proveedores: manda «Modelos por uso».
- No arrancar ni parar el servidor de la app.
- No aceptar imágenes en nombre de Paulo sin su autorización.
- No hacer commit sin que se pida.
- Hay cambios ajenos sin commitear en el árbol (cubiertas, prompts y vídeo): no revertirlos y editar con parches.

## Fuera de alcance

- Los inmuebles con varias plantas en el cierre de tejado.
- Rehacer los prompts de las vistas con captura 3D (unos 35 000 caracteres); se anota como riesgo.
- Corregir los datos de Test 6 (inodoros duplicados, tejado con moqueta).

## Criterios de éxito

- [x] El prompt de la cenital de Test 6 (revisión 49) tiene menos de 5000 caracteres (3165) e incluye la chimenea, las sillas, los 4 vehículos y los recuentos de sanitarios.
- [x] En la prueba real, la cenital la genera la ruta configurada sin `kie_prompt_too_long` (informe: `plans/reports/prueba-261006-1823-cenital-v5-y-tejado.md`).
- [x] Si la revisión no se completa (proveedor o informe incompleto), la imagen queda guardada con un motivo claro.
- [ ] El cierre de tejado produce una imagen nueva de la misma tanda, con `closedRoof` verdadero y la revisión de cubierta, encuadre e identidad superada (pendiente: hace falta una isométrica aceptada; Test 6 necesita su ortofoto).
- [x] Tests, `tsc`, lint, `docs:updates` y `docs:build` en verde.

<!-- slug: cenital-y-tejado-desde-modelo -->
