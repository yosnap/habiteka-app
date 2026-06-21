# P3 · Multi-zona (el cambio grande)

**Objetivo:** un inmueble (Project) con varias zonas/tomas (aérea, entrada, cocina…), cada una con
su(s) imagen(es), su plano y sus diseños, y estilo propio por zona. Migración v1→v2 aditiva.

**Riesgo:** alto. Quita un `@unique`, renombra una columna y toca la UX del editor/chat.
**REQUIERE `/ck:predict` (migración + UX) ANTES de implementar.**

**Depende de:** P1 (SourceImage con `zoneId?` ya existe como columna).

## Contexto (archivos a leer antes)

- `plan.md` (decisiones cerradas 1–6).
- `prisma/schema/project-canvas.prisma` — CanvasState (quitar @unique), AgentState (overrides),
  Iteration (rename zone→region), Deliverable (FK zone).
- `prisma/schema/user-auth.prisma` — Organization (FK de Zone).
- Editor de plano y su carga/guardado de `CanvasState` (hoy asume 1 por proyecto).
- `AgentState` y `collected` (Json del chat) — añadir overrides por zona.
- Flujo de feedback por zona (los 4 sitios del rename): `src/server/agent/feedback/iteration-repo.ts`,
  `feedback/feedback-orchestrator.ts`, `feedback/directed-inpaint.ts`, `src/app/api/iterations/route.ts`.

## Cambios de esquema

### Aditivo
```prisma
model Zone {
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
  @@map("zone")
}
```
- Añadir FK `zone Zone? @relation(...)` a `SourceImage.zoneId` (en P1 era columna suelta) y a
  `Deliverable.zoneId`.

### Cambio de índice (cuidado)
- `CanvasState.projectId`: ELIMINAR `@unique`. Añadir `zoneId String?` + FK
  `zone Zone? @relation(onDelete: Cascade)`. v1 = filas con `zoneId=null` (plano por defecto).
- Reversible mientras no exista >1 CanvasState por proyecto.

### Rename de columna (decisión 6)
- `Iteration.zone` (Json) → `Iteration.region` (Json). Migración de rename + actualizar los 4 sitios
  de escritura. Verificar que ninguna lectura quede apuntando a `zone`.

### AgentState (decisión 2 — estilo por zona)
- SIN cambio de cardinalidad (`projectId @unique` se mantiene). `collected` (Json) gana estructura
  de overrides por zona: estilo/objetivo por `zoneId`, con fallback al global del inmueble.

## Pasos de implementación (orden sugerido)

1. **Rename `Iteration.zone`→`region`** primero, aislado (migración + 4 sitios). Verificar feedback
   por zona sigue funcionando antes de seguir.
2. Crear `Zone` + FKs nullable (`CanvasState.zoneId`, `Deliverable.zoneId`, `SourceImage.zoneId` FK).
3. Quitar `@unique` de `CanvasState.projectId`. Migración aditiva (no backfill bloqueante).
4. Capa de acceso: repos de Zone/CanvasState scoped por org; "zona por defecto" = `zoneId=null`.
5. Overrides de estilo por zona en `AgentState.collected` (estructura + resolución con fallback).
6. UX: navegación por zonas dentro del proyecto; crear/renombrar/ordenar zonas; el editor abre el
   plano de la zona activa; el chat resuelve el estilo de la zona activa.
7. Migración: proyectos v1 siguen con `zoneId=null` (zona por defecto implícita). Job de backfill a
   Zone "Principal" SOLO si la UI lo necesita (incógnita abierta del plan).

## Validación

- `/ck:predict` ANTES de codear (migración + UX): caza problemas de diseño concretos.
- `bunx tsc` + eslint.
- Tests: rename region (round-trip feedback), multi CanvasState por proyecto, scope por org en Zone,
  overrides de estilo por zona con fallback, migración v1 (zoneId=null sigue válido).
- Verificación UI propia: proyecto multi-zona, estilo distinto por zona, plano por zona.
- Code-review (flujo cook): foco en la migración, el rename y el scope por org de Zone.

## Riesgos y rollback

- **Quitar @unique:** reversible si no hay >1 fila/proyecto. Hacerlo cuando la app aún escribe 1/proy.
- **Rename de columna:** un sitio olvidado rompe el feedback por zona → test de round-trip lo cubre.
- **Migración:** aditiva y null-tolerante → v1 nunca se rompe; rollback = revertir migración.
- **UX:** mayor superficie; mitigar entregando navegación de zonas detrás de la creación de la 2ª zona
  (un proyecto con 1 zona se ve igual que hoy).
