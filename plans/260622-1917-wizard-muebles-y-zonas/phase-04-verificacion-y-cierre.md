---
phase: 4
title: Verificacion y cierre
status: completed
effort: ''
---

# Phase 4: Verificacion y cierre

## Overview
Verificación end-to-end en navegador real, suite completa, build, code-review y cierre.

## Implementation Steps
1. `bunx vitest run` (466+ verdes) + `bunx tsc --noEmit` + eslint + `bun run build`.
2. Navegador real (dev-login → proyecto):
   - +Zona → wizard: medidas → tipo "Cocina" → paso de muebles con fregadero/encimera/nevera/horno
     marcados + isla opcional → Crear → ver en 3D que NO hay solapes.
   - Repetir con un salón (sillas con cantidad) para verificar repetibles.
   - Pasar el ratón sobre un chip de zona → Renombrar (cambia el nombre) y Borrar (confirmación →
     soft-delete: desaparece y navega a Principal). Abrir Papelera → Restaurar la zona (reaparece con
     su contenido) y, en otra, Borrar definitivamente (purge → ya no está en la papelera).
   - Wizard con un mueble que no cabe (cocina pequeña + isla) → aviso de omitido, sin solapes.
3. Capturas a `plans/260622-1917-wizard-muebles-y-zonas/reports/`.
4. Code-review del cambio (agente). Actualizar memoria de proyecto.

## Success Criteria
- [ ] tsc + eslint + vitest + build verdes.
- [ ] Navegador: wizard cocina sin solapes en 3D; selección respetada; aviso de omitidos; renombrar,
      borrar (soft) + papelera (restaurar/purgar) OK.
- [ ] Code-review sin Críticos/Altos abiertos.

## Risk Assessment
- **Flujo +Zona headless:** crear zona y navegar a ella puede requerir recargar (limitación
  preexistente, ajena a este cambio). Verificar navegando a la zona creada.
- **Limpieza:** las zonas de prueba creadas se borran con la nueva función (verificación y limpieza
  a la vez); `bun run db:dev-seed` si hace falta restablecer ejemplos.
