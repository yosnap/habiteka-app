---
title: "Fase 6: Composiciones por ambiente para la IA de propuesta"
status: todo
---

# Fase 6: Composiciones por ambiente para la IA de propuesta

## Contexto

La propuesta nativa coloca solo `catalogId` existentes (`native-design-proposal.ts:163-169,
229-247`) y filtra por `proposalCategory`/`allowedProposalCatalog`
(`proposal-permissions.ts:8-25`) con categorías `plants | mirrors | lights | furniture | decor`
(`render-design-options.ts:5`). El contexto de diseño (`design-context.ts`) resume el catálogo
al modelo. Con ≈ 130 activos y conjuntos, el modelo necesita **composiciones** (sets por
estancia y estilo) para amueblar coherente sin enumerar todo el catálogo, en línea con el
auto-amueblado procedural observado en Planner 5D (referencia jun-2026).

## Requisitos

- Definir `DesignSet { id, room, style, items: { catalogId, role, anchor, elevationMm? }[] }`
  para 8 estancias × 4 estilos (Nórdico, Contemporáneo, Clásico, Industrial ya usados en
  `furniture-catalog.ts`), con roles (`principal`, `apoyo`, `textil`, `luz`, `verde`, `pared`) y
  anclajes (`contra-muro`, `bajo-ventana`, `centro`, `sobre-superficie:<role>`, `techo`, `muro`).
- El prompt de propuesta recibe los sets aplicables (estancia + estilo + ámbito) y el catálogo
  reducido a los `catalogId` de esos sets + los ya presentes; el modelo puede elegir subconjuntos
  y sustituir por variantes, no inventar ids.
- `proposalCategory` cubre `wall-art`, `mirror`, `chandelier`, `curtain` (ya `decor`) y
  `plant`; nuevos permisos `additions` no se añaden (se mapean a las 5 existentes).
- Colocación validada por `allowedProposalFurniture` + huecos (`bajo-ventana` exige ventana en
  ese muro; `muro` exige muro libre de huecos en el ancho del cuadro).

## Archivos

- Nuevo `src/lib/editor-document/design-sets.ts` (≤ 200 líneas; si crece, un archivo por
  estancia en `design-sets/`): datos + `applicableDesignSets(room, style, scope)`.
- `src/lib/editor-document/proposal-permissions.ts`: perfiles nuevos en `proposalCategory`.
- `src/lib/editor-document/design-context.ts`: incluir sets y catálogo reducido; medir tokens de
  entrada (regla del plan integral: presupuesto de entrada por operación).
- `src/lib/editor-document/native-design-proposal.ts`: validar `anchor` (ventana/muro) reutilizando
  `wall-back-alignment.ts` y las aperturas del documento.
- Prompt: `src/server/ai/**` donde se construye la propuesta de diseño (localizar con grep
  `designContext` al implementar; [UNVERIFIED] ruta exacta).
- Tests: `tests/editor-document/design-sets.test.ts` (cada set referencia ids existentes con GLB;
  cotas caben en una estancia de 3×4), `tests/editor-document/proposal-permissions.test.ts`
  (nuevas categorías), ampliación de `native-design-proposal` tests con anclaje `bajo-ventana`.

## Pasos

1. Redactar los 32 sets a partir de los activos de fases 2 y 5 (hoja en
   `plans/reports/referencia-interiores/design-sets.md`).
2. `design-sets.ts` + tests de integridad.
3. Permisos y contexto; medir tokens antes/después en una propuesta de «Salón» (objetivo: no
   superar el contexto actual + 30 %).
4. Validación de anclajes en la propuesta.
5. Prueba: propuesta de «Salón · Nórdico» sobre el plano de referencia con libertad
   `controlled` y `additions` completas → C4/C5 tras aplicar la propuesta deben puntuar ≥ 60 sin
   retoque manual.

## Validación

- Tests verdes; propuesta reproducible en el proyecto de referencia sin ids inválidos (log del
  validador con 0 rechazos por id).
- Jev puede clasificar el estilo de la propuesta como coherente (opcional, no bloqueante).

## Riesgos

- Sets demasiado rígidos → dejar al modelo elegir subconjuntos y variantes; los sets son menú,
  no plantilla obligatoria.
- Coste de tokens: si el catálogo reducido sigue siendo grande, enviar solo `id + label + cotas`.

## Rollback

Sets vacíos = comportamiento actual. Sin cambios de esquema de documento.
