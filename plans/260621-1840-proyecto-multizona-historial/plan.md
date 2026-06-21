# Proyecto multi-zona con historial imagen→diseño

**Tipo:** rediseño de producto (modelo de datos + UX). NO es una fase del roadmap de "diseños
interactivos" (ese asume 1 plano/proyecto). Surge de una necesidad real del usuario (jun-2026).

**Estado:** 📋 PLANIFICADO. Brainstorm del modelo de datos CERRADO (jun-2026). No se ha tocado
código. Siguiente paso recomendado antes de implementar P3: `/ck:predict` (migración + UX).

## Problema (verificado en el código)

Hoy el modelo es **1 imagen efímera + 1 plano + entregables por proyecto**:
- La imagen subida en la ingesta **NO se persiste** (se manda a la IA y se descarta). El `Project`
  no tiene campo de imagen de origen.
- `CanvasState` es **1:1 con `Project`** (`projectId @unique`) → un solo plano por proyecto.
- `AgentState` (estado del chat/agente) también es **1:1 con `Project`** (`projectId @unique`).
- No hay relación "esta imagen → produjo este diseño": el `Deliverable` no guarda su origen.
- `MediaAsset` (en `admin.prisma`) **NO tiene `organizationId` ni FK a `Project`** → es catálogo
  admin, no sirve para anclar imágenes de usuario con scope de organización (reusarlo abriría IDOR
  y mezclaría dato personal RGPD con catálogo admin).

El usuario necesita: un **inmueble (proyecto)** con **varias tomas/zonas** (aérea, entrada,
interior, trasera) + **varios planos**, un **diseño por cada una**, y poder **comparar** lo que
subió con lo que la IA generó, con **historial**.

## Hallazgo clave del brainstorm

El cuello de botella REAL no es `CanvasState 1:1` — es que **no existe ninguna entidad que ancle
la imagen de origen con scope de organización**. Ese agujero (RGPD + IDOR) se resuelve sin tocar el
esquema central, en P1, y es la misma decisión que condiciona P3. Por eso P1 NO es "solo guardar la
imagen": es crear la entidad `SourceImage` correcta + la trazabilidad origen→diseño.

## Lo que ya existe y se reaprovecha

- Infra de **storage backend** (`server/storage`) → reusar el backend, NO la tabla `MediaAsset`.
- Infra **RGPD**: `src/server/privacy/face-blur.ts`, `human-face-detector.ts`, soft-delete
  (`deletedAt`) en Project/Deliverable, retención/borrado ya existentes → la entidad nueva engancha
  ahí (`faceBlurred`, `deletedAt`).
- Render desde plano (CRL-4), detección desde foto (F5), escala (F0), luces (F-LUZ), catálogo (F-CAT).
- `Deliverable` ya es **1:N** con Project + soft-delete → base del historial ya existe.
- El editor de plano y los entregables ya funcionan; el cambio es de ESTRUCTURA, no de capacidades.

## Decisiones CERRADAS (brainstorm jun-2026)

1. **Jerarquía = entidad `Zone` delgada.** `Project 1:N Zone`. `Zone` es un agrupador esbelto
   (id, org, project, name, kind, order); el plano (`CanvasState`), la imagen (`SourceImage`) y los
   diseños (`Deliverable`) le cuelgan con FK `zoneId` **nullable**. Aditivo: v1 vive con `zoneId=null`
   (= zona por defecto implícita, NO una fila fantasma).
   - Descartado: `Project → Plano (1:N)` sin entidad Zona (agrupación implícita frágil).
   - Descartado: big-bang moviendo todas las FK a Zone.

2. **Estilo distinto por zona (decisión del usuario).** Cada zona puede tener su propio
   estilo/objetivo (cocina industrial + dormitorio nórdico en el mismo inmueble). Implicación:
   - **`AgentState` sigue 1:1 con `Project`** (una sola conversación del inmueble), PERO su `collected`
     admite **overrides por zona** (estructura Json: estilo/objetivo por `zoneId`). NO se rompe el
     `@unique` de AgentState; el chat es del inmueble, el estilo se especializa por zona dentro del
     estado. Esto es P3 (cuando existan zonas reales); en P1/P2 el estilo sigue global.

3. **Imagen de origen = entidad nueva `SourceImage`** con `organizationId` obligatorio (cierra IDOR),
   `projectId`, `zoneId?` (null en P1). Reusa el **storage backend** de MediaAsset, NO su tabla.
   - **Varias imágenes por zona** (`role`: PRIMARY = referencia que alimenta el diseño, DETAIL = tomas
     extra). NO meter el listado en un Json (se perdería consulta y borrado granular RGPD).
   - `faceBlurred` + `deletedAt` enganchan `face-blur`/retención existentes.

4. **Trazabilidad origen→diseño = FK real** `Deliverable.sourceImageId?` (+ `zoneId?`), ambas nullable.
   Descartado guardar el origen en `payload` Json (un id colgando a una imagen borrada viola la
   verificabilidad del borrado RGPD; sin FK no hay cascada ni JOIN).

5. **Migración v1→v2 = aditiva pura, sin backfill bloqueante.** Todas las tablas/columnas nuevas
   nullable. v1 funciona con `zoneId=null`. La única operación que altera algo existente: quitar
   `@unique` de `CanvasState.projectId` (índice único → normal; reversible mientras no haya >1 fila
   por proyecto). El backfill a Zone explícita, si alguna vez se necesita, es un job idempotente
   posterior, no requisito de la migración.

6. **Nombre de la entidad = `Zone`; renombrar lo viejo (decisión del usuario).** Ya existe
   `Iteration.zone` (Json = región de inpainting del feedback). Para que la entidad nueva se llame
   `Zone` (nombre limpio), se renombra el campo viejo `Iteration.zone` → `region`. Blast radius
   acotado y verificado: columna BD + ~4 sitios de escritura (`feedback/iteration-repo.ts`,
   `feedback/feedback-orchestrator.ts`, `feedback/directed-inpaint.ts`, `app/api/iterations/route.ts`).
   Es una migración de rename de columna (parte de P3).

## Esquema objetivo (referencia; el detalle por fase en los phase-*.md)

```prisma
// ===== P1 (ADITIVO — no rompe v1) =====
model SourceImage {
  id             String          @id @default(cuid())
  organizationId String                                   // scope multi-tenant OBLIGATORIO (cierra IDOR)
  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  projectId      String
  project        Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  zoneId         String?                                  // P1: null. P3: la zona dueña.
  zone           Zone?           @relation(fields: [zoneId], references: [id], onDelete: SetNull)
  key            String                                   // clave en storage backend (reusa server/storage)
  url            String
  mime           String
  width          Int?
  height         Int?
  role           SourceImageRole @default(PRIMARY)        // PRIMARY = referencia que alimenta el diseño
  faceBlurred    Boolean         @default(false)          // engancha face-blur / pii-scrub
  status         String          @default("READY")
  createdAt      DateTime        @default(now())
  deletedAt      DateTime?                                // engancha retención / borrado RGPD
  deliverables   Deliverable[]
  @@index([organizationId]); @@index([projectId]); @@index([zoneId]); @@index([deletedAt])
  @@map("source_image")
}
enum SourceImageRole { PRIMARY  DETAIL }

// CAMBIO ADITIVO en Deliverable (ambas nullable → v1 intacto)
//   sourceImageId String?  + relación SetNull
//   zoneId        String?  + relación SetNull

// ===== P3 (ADITIVO + 1 cambio de índice + 1 rename) =====
model Zone {
  id             String       @id @default(cuid())
  organizationId String                                   // denormalizado para filtrar IDOR barato
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  projectId      String
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name           String                                   // "Aérea", "Entrada", "Cocina"...
  kind           String?                                  // taxonomía opcional (aerea/entrada/interior/trasera)
  order          Int          @default(0)
  createdAt      DateTime     @default(now())
  deletedAt      DateTime?
  canvasStates   CanvasState[]
  sourceImages   SourceImage[]
  deliverables   Deliverable[]
  @@index([projectId]); @@index([organizationId])
  @@map("zone")
}
// CanvasState: ELIMINAR @unique de projectId, AÑADIR zoneId String? (null = plano por defecto v1).
// AgentState:  SIN cambio de cardinalidad. collected (Json) gana overrides por zona (decisión 2).
// Iteration:   RENOMBRAR campo `zone` Json → `region` Json (decisión 6).
```

## Fases (cada una es un PR independiente; orden = riesgo creciente)

- **P1 · `SourceImage` + trazabilidad origen→diseño** (aditivo, bajo riesgo, alto valor).
  Crear `SourceImage` (scope org, role PRIMARY/DETAIL, RGPD) + `Deliverable.sourceImageId?`/`zoneId?`.
  Persistir la foto subida en la ingesta y mostrar "subí esto ↔ generé esto". SIN entidad Zone, SIN
  tocar `CanvasState`/`AgentState`. Cierra el agujero RGPD/IDOR. → `phase-p1-source-image.md`
- **P2 · Galería de historial origen↔diseño** (aditivo, casi gratis).
  Vista de solo lectura sobre lo de P1: imágenes subidas + diseños generados, qué produjo qué.
  → `phase-p2-galeria-historial.md`
- **P3 · Multi-zona** (aditivo + 1 cambio de índice + 1 rename; el cambio grande).
  Entidad `Zone`; `zoneId?` nullable en CanvasState/Deliverable/SourceImage; quitar `@unique` de
  `CanvasState.projectId`; overrides de estilo por zona en `AgentState.collected`; rename
  `Iteration.zone`→`region`. Migración v1→v2 aditiva (zoneId=null = zona por defecto). UX de
  navegación por zonas. **Requiere `/ck:predict` (migración + UX) antes de implementar.**
  → `phase-p3-multizona.md`

## Riesgos

- **Alto:** P3 quita el `@unique` de `CanvasState` (cambio de índice) y renombra `Iteration.zone`
  (migración de columna + ~4 sitios). Toca la UX del editor/chat. Por eso `/ck:predict` antes.
- **RGPD:** persistir imágenes de usuario añade superficie de dato personal. Mitigado por diseño:
  `SourceImage` con `deletedAt` + `faceBlurred` engancha retención/face-blur ya existentes.
- **Coste/storage:** N imágenes × N zonas × N diseños multiplica storage → política de cuota por
  organización/plan (incógnita abierta, ver abajo).

## Cómo se ejecuta

1. ✅ Brainstorm de las decisiones de modelo → CERRADO (este plan).
2. Implementar **P1** (da valor sin romper el modelo actual; aditivo).
3. **P2** sobre P1 (solo lectura).
4. **/ck:predict** sobre P3 (cambio de esquema + UX) antes de implementar.
5. Implementar **P3**.

## Incógnitas abiertas para el usuario

- **¿Plano obligatorio por zona?** El modelo permite zona con imágenes y 0 planos (ej. zona aérea
  solo foto). ¿Válido o toda zona debe tener plano? Afecta validaciones, no el esquema.
- **Cuota de storage por organización/plan de billing.** ¿Límite de imágenes/diseños por inmueble?
  Condiciona si `SourceImage` necesita contador agregado o se calcula on-demand.
- **Retención RGPD diferenciada.** ¿TTL distinto para `SourceImage` (dato personal) que para
  `Deliverable`? Confirmar que el retention-job actual purgue también la tabla nueva.
- **Backfill diferido.** ¿Conviven con `zoneId=null` indefinidamente (KISS) o un job materializa una
  Zone "Principal" por proyecto para uniformidad de UI? Recomendado: null indefinido salvo que la UI
  lo sufra.
