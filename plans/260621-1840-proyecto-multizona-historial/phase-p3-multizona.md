# P3 · Multi-zona (el cambio grande)

**Objetivo:** un inmueble (Project) con varias zonas/tomas (aérea, entrada, cocina…), cada una con
su(s) imagen(es), su plano y sus diseños, y estilo propio por zona. Migración v1→v2 aditiva.

**Riesgo:** medio (rebajado desde alto tras /ck:predict, jun-2026). Ya NO hay rename de columna.
La única operación delicada es quitar `@unique` de `CanvasState.projectId`, diferible.

**Depende de:** P1 (SourceImage con `zoneId?` ya existe como columna) y P2.

## Correcciones del /ck:predict (jun-2026) — decisiones revisadas

El predict (CAUTION) reordenó dos decisiones cerradas:

1. **Entidad = `ProjectZone` (NO `Zone`), y NO se renombra `Iteration.zone`.** Motivo verificado en
   código: "zone" ya es un vocabulario consolidado que significa **región de inpainting/máscara** —
   `CanvasZone`/`PlanZone` (contracts), `resolveZone`/`replaceZone`/`regenerateZone`,
   `buildInpaintZone`, todo el módulo `src/server/agent/feedback/`, 18 archivos. `Iteration.zone`
   guarda un `CanvasZone` (id/box/maskRef), no una toma del inmueble. Llamar `ProjectZone` a la
   entidad nueva distingue sin ambigüedad y **elimina el rename de columna** (riesgo puro sin pago: el
   usuario nunca ve el nombre interno). En la UI se llama "Zona".
2. **Estilo por zona se fija en el EDITOR DEL PLANO de cada zona, no en el chat.** El chat sigue
   global al inmueble (`AgentState` 1:1, sin tocar). Cada zona fija su estilo desde su propio
   formulario (`generate-from-canvas-dialog`, que ya recoge estilo). El override por zona vive en
   `AgentState.collected` pero lo escribe el editor, no el chat → sin confusión "chat global / estilo
   por zona".
3. **Quitar `@unique` de `CanvasState.projectId` SOLO al implementar crear-2ª-zona, no antes.** Hasta
   entonces v1 sigue 1:1. Empezar por lo aditivo (entidad + FKs), que da valor sin tocar lo existente.

## Contexto (archivos a leer antes)

- `plan.md` (decisiones cerradas 1–6 + correcciones del predict).
- `prisma/schema/project-canvas.prisma` — CanvasState (quitar @unique), Deliverable/SourceImage
  (FK a ProjectZone), Iteration (NO se toca).
- `prisma/schema/user-auth.prisma` — Organization (FK de ProjectZone).
- `src/server/db/scoped-repo.ts` — patrón `withOrg` (puerta anti-IDOR); ahí cuelgan los repos nuevos.
- Editor de plano y su carga/guardado de `CanvasState`: `src/server/actions/canvas.ts`
  (`withOrg(ctx).canvas.load/save`, hoy 1:1 por projectId).
- `AgentState` y `collected` (Json) — overrides de estilo por zona, escritos desde el editor.

## Cambios de esquema

### Aditivo
```prisma
model ProjectZone {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  projectId      String
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name           String
  kind           String?
  order          Int          @default(0)
  createdAt      DateTime     @default(now())
  deletedAt      DateTime?
  canvasStates   CanvasState[]
  sourceImages   SourceImage[]
  deliverables   Deliverable[]
  @@index([projectId]); @@index([organizationId])
  @@map("project_zone")
}
```
- Añadir FK `zone ProjectZone? @relation(...)` a `SourceImage.zoneId` (en P1 era columna suelta) y a
  `Deliverable.zoneId`.

### Cambio de índice (diferido a crear-2ª-zona)
- `CanvasState.projectId`: ELIMINAR `@unique`. Añadir `zoneId String?` + FK
  `zone ProjectZone? @relation(onDelete: Cascade)`. v1 = filas con `zoneId=null` (plano por defecto).
- Reversible mientras no exista >1 CanvasState por proyecto.

### Iteration — NO se toca
- El rename `zone→region` queda DESCARTADO (corrección 1 del predict). `Iteration.zone` (región de
  inpainting) se mantiene tal cual.

### AgentState (estilo por zona) — sin cambio de cardinalidad
- `projectId @unique` se mantiene. `collected` (Json) gana overrides por zona (estilo/objetivo por
  `zoneId`, fallback al global). Lo escribe el editor del plano de la zona, no el chat.

## Pasos de implementación (orden: aditivo primero)

1. Crear `ProjectZone` + FKs nullable (`CanvasState.zoneId`, `Deliverable.zoneId`,
   `SourceImage.zoneId` FK). Migración aditiva. (NO se toca Iteration.)
2. Capa de acceso: repos de ProjectZone/CanvasState scoped por org (vía `withOrg`); "zona por
   defecto" = `zoneId=null`.
3. Overrides de estilo por zona en `AgentState.collected` (estructura + resolución con fallback),
   escritos desde el formulario del plano.
4. UX: navegación por zonas dentro del proyecto (crear/renombrar/ordenar); el editor abre el plano de
   la zona activa. Detrás de "crear 2ª zona": un proyecto de 1 zona se ve igual que hoy.
5. Quitar `@unique` de `CanvasState.projectId` (cuando el paso 4 cree 2ª zona). Migración.
6. Backfill a ProjectZone "Principal" SOLO si la UI lo necesita (incógnita abierta del plan).

## Validación

- `bunx tsc` + eslint.
- Tests: multi CanvasState por proyecto, scope por org en ProjectZone (anti-IDOR, patrón P1),
  overrides de estilo por zona con fallback, migración v1 (zoneId=null sigue válido).
- Verificación UI propia (dev server :3040, login `/api/dev/login`): proyecto multi-zona, estilo
  distinto por zona, plano por zona. **Confirmar que las rutas compilan (lección de P1).**
- Code-review (flujo cook): foco en la migración, el scope por org de ProjectZone y la UX de zonas.

## Riesgos y rollback

- **Quitar @unique:** reversible si no hay >1 fila/proyecto. Hacerlo cuando la app cree la 2ª zona.
- **Migración:** aditiva y null-tolerante → v1 nunca se rompe; rollback = revertir migración.
- **UX:** mayor superficie; mitigar entregando navegación de zonas detrás de la creación de la 2ª zona
  (un proyecto con 1 zona se ve igual que hoy).
- **Sin rename de Iteration** → desaparece el riesgo de romper el feedback por zona.
