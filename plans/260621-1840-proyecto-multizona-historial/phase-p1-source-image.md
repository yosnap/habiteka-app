# P1 · SourceImage + trazabilidad origen→diseño

**Objetivo:** persistir la imagen que el usuario sube en la ingesta y vincularla al diseño que
produjo, con scope de organización (cierra IDOR) y enganche RGPD. SIN entidad Zone, SIN tocar
`CanvasState`/`AgentState`. Aditivo: no rompe proyectos v1.

**Riesgo:** bajo. Solo añade una tabla + dos columnas nullable + un punto de persistencia.

## Contexto (archivos a leer antes)

- `prisma/schema/project-canvas.prisma` — Project, Deliverable, CanvasState.
- `prisma/schema/user-auth.prisma` — Organization (FK objetivo; `id String`).
- `prisma/schema/admin.prisma` — MediaAsset (NO reusar la tabla; solo referencia).
- `src/server/storage/` — backend de storage a reusar para subir el binario.
- `src/server/agent/phases/ingesta.ts` — dónde llega hoy la imagen (hoy se cuenta y se descarta).
- `src/server/privacy/face-blur.ts`, `human-face-detector.ts` — enganche RGPD para `faceBlurred`.
- Memoria: `agente-acciones-acotar-proyecto-org` (validar pertenencia en la Server Action).

## Cambios de esquema (aditivos)

```prisma
model SourceImage {
  id             String          @id @default(cuid())
  organizationId String
  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  projectId      String
  project        Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  zoneId         String?         // P1: siempre null (la entidad Zone llega en P3)
  key            String          // clave en storage backend
  url            String
  mime           String
  width          Int?
  height         Int?
  role           SourceImageRole @default(PRIMARY)
  faceBlurred    Boolean         @default(false)
  status         String          @default("READY")
  createdAt      DateTime        @default(now())
  deletedAt      DateTime?
  deliverables   Deliverable[]
  @@index([organizationId]); @@index([projectId]); @@index([zoneId]); @@index([deletedAt])
  @@map("source_image")
}
enum SourceImageRole { PRIMARY  DETAIL }
```

En `Deliverable` (aditivo, nullable):
```prisma
  sourceImageId String?
  sourceImage   SourceImage? @relation(fields: [sourceImageId], references: [id], onDelete: SetNull)
  zoneId        String?      // P1: null; lo usa P3
  // @@index([sourceImageId])
```
`Project` y `Organization` ganan la relación inversa `sourceImages SourceImage[]`.

> Nota: NO añadir aún la relación `zone Zone?` en SourceImage (la entidad Zone no existe hasta P3).
> El campo `zoneId String?` queda como columna suelta sin FK en P1; la FK se añade en P3.

## Pasos de implementación

1. Editar el schema (bloques de arriba). `bunx prisma migrate dev --name source_image_y_trazabilidad`.
2. Repo de persistencia: módulo `src/server/.../source-image-repo.ts` (crear/leer/soft-delete),
   SIEMPRE filtrando por `organizationId` (patrón scoped-repo existente).
3. Server Action que recibe la imagen de la ingesta: subir binario vía `server/storage`, crear
   `SourceImage` con `organizationId` de la sesión + `projectId` validado contra la org (anti-IDOR).
   Aplicar `face-blur` según política existente y marcar `faceBlurred`.
4. Al generar un Deliverable desde esa imagen, setear `Deliverable.sourceImageId`.
5. UI mínima: en la ficha del proyecto, mostrar la imagen de origen junto al diseño ("origen ↔ diseño").
6. Borrado: confirmar que el flujo de borrado del proyecto/retención cubre `SourceImage`
   (soft-delete por `deletedAt`; hard-delete RGPD purga la fila + el binario en storage).

## Validación

- `bunx tsc` (typecheck) + eslint.
- Tests focales `bunx vitest run tests/canvas/` y nuevos tests del repo (scope por org: una org NO
  ve `SourceImage` de otra; soft-delete; vínculo Deliverable→SourceImage).
- Verificación UI propia (chrome-devtools MCP): login `/api/dev/login` → subir foto → ver
  origen↔diseño en `/projects/<id>`.
- Code-review obligatorio (flujo cook), foco en IDOR y RGPD (superficie nueva de dato personal).

## Riesgos y rollback

- Migración aditiva → rollback = revertir migración (no hay datos críticos nuevos al inicio).
- Riesgo principal: olvido de scope por org en alguna lectura → test explícito anti-IDOR lo cubre.
