# Fase 3 — Auto-amueblado en formas + verificación 3D y cierre

## Contexto
- `autofurnish.ts`: precondición rectángulo (`interiorRect` → null si no es rect). Hoy amuebla solo
  salas rectangulares.
- `doc-to-scene.ts`: extruye cualquier muro a la altura de techo (hipótesis: el 3D funciona con
  L/U/T sin cambios).

## Requisitos
Definir el comportamiento del auto-amueblado en formas no rectangulares y verificar 2D+3D.

## Auto-amueblado (alcance MVP — decisión confirmada en el predict)
Opción por defecto: **amueblar el sub-rectángulo principal de la forma** (el mayor rectángulo
inscrito axis-aligned) y dejar el resto vacío, O bien **omitir el auto-amueblado en L/U/T con aviso
honesto** ("Esta forma se amuebla a mano"). El predict elige una; la otra queda anotada.
- Si se amuebla el sub-rect: derivarlo del contorno (mayor rect inscrito) y pasar ese `inner` al
  algoritmo actual SIN cambiarlo (reuso). Verificar que ningún mueble cae fuera del contorno real.
- Si se omite: el wizard salta el paso de muebles para L/U/T (o lo deja manual) con mensaje claro.

## Verificación 3D (hipótesis del plan)
- Crear sala en L/U/T → "Ver en 3D": los muros deben extruirse y formar el contorno correcto.
- Si NO funciona (p. ej. el suelo usa bbox rectangular del contorno), es trabajo de esta fase:
  ajustar la generación del suelo 3D al polígono real. Anotar lo encontrado.

## Validación automática
- `bunx vitest run` — suite verde (incluye tests de fase 1).
- `bunx tsc` + eslint + `next build` limpios.

## Verificación en navegador
1. Wizard → forma L → medidas → crear: contorno correcto en 2D (cerrado, sin huecos).
2. "Ver en 3D": muros extruidos formando la L; suelo correcto.
3. Auto-amueblado según lo decidido (sub-rect amueblado sin muebles fuera, u omitido con aviso).
4. Rectángulo: sin regresión (mismo contorno y mismo auto-amueblado que antes).

## Cierre
- Marcar fases y `plan.md` completed; criterios `[x]` verificables.
- Reporte en `plans/reports/`. Actualizar memoria (Tier 2: formas de sala).

## Riesgos / rollback
- Riesgo: el suelo 3D asume rectángulo → la L mostraría suelo de más. Mitigación: verificar y, si
  aplica, generar el suelo del polígono. Es el riesgo principal del plan.
- Rollback: `buildRoomDoc` mantiene el caso rect idéntico; quitar el selector de forma del wizard
  deja todo como hoy.
