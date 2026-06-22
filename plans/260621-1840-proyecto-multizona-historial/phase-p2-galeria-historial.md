# P2 · Galería de historial origen↔diseño

**Objetivo:** vista de solo lectura del historial de un proyecto: imágenes subidas (`SourceImage`)
+ diseños generados (`Deliverable`), mostrando qué imagen produjo qué diseño. Aditivo, casi gratis
sobre P1.

**Riesgo:** muy bajo. No cambia esquema; solo consulta y presenta lo de P1.

**Depende de:** P1 (necesita `SourceImage` + `Deliverable.sourceImageId`).

## Contexto (archivos a leer antes)

- `phase-p1-source-image.md` (modelo de datos del que se lee).
- Página/ruta actual del proyecto `/projects/<id>` y sus componentes de listado de entregables.
- `src/server/.../source-image-repo.ts` (creado en P1) y el repo de deliverables.

## Pasos de implementación

1. Query de historial (scope por org): por `projectId`, traer `SourceImage[]` (no borradas) y
   `Deliverable[]` con su `sourceImageId`, agrupados por imagen de origen.
2. Componente de galería: por cada imagen de origen, mostrar miniatura + los diseños que produjo.
   Diseños sin `sourceImageId` (los v1 previos a P1) van a un grupo "Sin imagen de origen".
3. Estados vacíos: proyecto sin imágenes / sin diseños.
4. Solo lectura (no acciones destructivas en esta fase).

## Validación

- `bunx tsc` + eslint.
- Test de la query (agrupación correcta, scope por org, deliverables huérfanos en su grupo).
- Verificación UI propia: proyecto con varias imágenes y diseños → galería agrupa bien.
- Code-review (flujo cook), foco en que la query respete el scope por organización.

## Riesgos y rollback

- Sin cambios de datos → rollback = quitar la vista. Sin impacto en escritura.
- Único riesgo: N+1 en la query del historial → cargar con `include`/agrupación en una sola consulta.
