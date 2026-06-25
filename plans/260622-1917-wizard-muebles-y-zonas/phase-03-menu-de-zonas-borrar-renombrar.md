---
phase: 3
title: 'Zonas: papelera (soft-delete + restaurar) + renombrar'
status: completed
effort: ''
---

# Phase 3: Zonas — papelera (soft-delete + restaurar) + renombrar

## Overview
Borrado de zona con PAPELERA (decisión usuario): borrar = soft-delete (recuperable); una vista de
papelera lista las zonas borradas y permite restaurarlas o borrarlas definitivamente. Más renombrar.
Menú al pasar el ratón sobre el chip de zona (no sobre "Principal").

## Contexto verificado (no reimplementar)
- `ProjectZone` YA tiene `deletedAt DateTime?` + `@@index([deletedAt])` en el esquema → **sin migración**.
- `zones.list` (scoped-repo.ts:290) YA filtra `deletedAt: null` (oculta borradas).
- `zones.remove` (scoped-repo.ts:317) hoy hace **hard-delete** (`deleteMany`) — hay que cambiarlo a
  soft-delete. El hard-delete real se conserva como `purge` (papelera → borrar definitivo).
- IDOR cubierto: todas las ops filtran por `{projectId, organizationId}` (verificado).
- Diseños/imágenes de la zona: FK SetNull (quedan con `zoneId=null`). Con soft-delete NO se tocan
  hasta el purge → al restaurar la zona, su contenido sigue ahí. En el purge se aplica el SetNull/Cascade
  actual (plano se borra, imágenes/diseños se desasignan).

## Requirements
- Funcional: cada chip de zona (no Principal) ofrece, al hover/foco, Renombrar y Borrar.
- Funcional: Borrar = soft-delete (marca `deletedAt`), con confirmación. Si era la activa → ir a Principal.
- Funcional: acceso a "Papelera" del proyecto: lista de zonas borradas con Restaurar y Borrar
  definitivamente (purge). Restaurar pone `deletedAt = null`; purge hace el hard-delete actual.
- No-funcional: accesible por teclado; IDOR mantenido; confirmación coherente con el patrón del repo.

## Architecture
**Backend** `scoped-repo.ts` (zones) + `zone-actions.ts`:
- `zones.remove` → SOFT: `updateMany({ where: {id,projectId,organizationId,deletedAt:null}, data:{deletedAt:new Date()} })`.
- `zones.listDeleted(projectId)` → `findMany({ where:{projectId,deletedAt:{not:null}, project:{organizationId,deletedAt:null}} })`.
- `zones.restore(projectId, zoneId)` → `updateMany({ where:{id,projectId,organizationId}, data:{deletedAt:null} })`.
- `zones.purge(projectId, zoneId)` → el `deleteMany` actual (hard-delete real + Cascade del plano).
- Acciones nuevas en `zone-actions.ts`: `listDeletedZones`, `restoreZone`, `purgeZone` (mismo patrón
  `requireOrgContext` + `assertProjectInOrg`). `deleteZone` pasa a soft (ya limpia el override de estilo;
  con soft-delete, mantener el override hasta el purge para poder restaurar con su estilo → mover la
  limpieza del override a `purgeZone`).

**UI** `zone-switcher.tsx`:
- Chip de zona → contenedor con botón de navegación + botón de menú (⋯) visible en hover/focus-within.
  Menú: Renombrar (input inline, patrón "+ Zona") y Borrar (confirmación inline → `deleteZone` soft).
- Tras borrar la activa → `router.push('/projects/{id}')`; siempre `router.refresh()`.
- Acceso a Papelera: un botón "Papelera" (con conteo si >0) que abre un panel/diálogo listando las
  zonas borradas (`listDeletedZones`) con Restaurar y Borrar definitivamente (purge, con confirmación).
- "Principal" sigue siendo un Chip aparte SIN menú (verificado: está fuera del `.map(zones)`).

## Related Code Files
- Modify: `src/server/db/scoped-repo.ts` (zones: remove→soft, +listDeleted/restore/purge + tipos).
- Modify: `src/app/(app)/projects/[id]/_actions/zone-actions.ts` (deleteZone→soft, +listDeleted/restore/purge;
  mover limpieza de override a purge).
- Modify: `src/components/canvas/zone-switcher.tsx` (menú por chip + panel de papelera).
- (Posible) Create: `src/components/canvas/zone-trash.tsx` si el panel de papelera crece (mantener <1000 líneas).

## Implementation Steps
1. Backend: `zones.remove`→soft; añadir `listDeleted`/`restore`/`purge` en scoped-repo (con tipos en la interfaz).
2. Acciones: `deleteZone`→soft (sin limpiar override aún), `listDeletedZones`, `restoreZone`, `purgeZone`
   (purge limpia el override de estilo). Verificar IDOR en cada una.
3. UI: menú ⋯ por chip (renombrar/borrar) + panel Papelera (restaurar/purgar).
4. Navegación tras borrar la activa → Principal; refresh. Cancelar autosave pendiente antes de navegar (M4).
5. tsc + eslint; verificación en navegador (fase 4).

## Success Criteria
- [ ] Borrar zona = soft-delete: desaparece de los chips pero es recuperable; confirmación; navegación OK.
- [ ] Papelera lista las borradas; Restaurar las devuelve con su contenido; Borrar definitivo (purge) las elimina.
- [ ] Renombrar funciona; "Principal" sin menú; accesible por teclado.
- [ ] IDOR mantenido en todas las acciones (verificado); tsc + eslint limpios.

## Risk Assessment
- **Soft vs hard (decisión usuario = papelera):** `remove` pasa a soft; el hard-delete vive solo en `purge`.
  Sin migración (el esquema ya tiene `deletedAt`).
- **Override de estilo:** con soft-delete no limpiar el override al borrar (para restaurar con estilo);
  limpiarlo solo en `purge`.
- **Borrar la activa (M4):** navegar a Principal + refresh; cancelar autosave pendiente para no
  re-persistir contra una zona recién borrada.
- **IDOR:** mantener el filtro `{projectId, organizationId}` en remove/restore/purge/listDeleted.
- **Tamaño de archivo:** si `zone-switcher` + papelera supera ~300 líneas, extraer `zone-trash.tsx`.
