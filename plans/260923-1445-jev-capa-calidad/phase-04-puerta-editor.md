---
phase: 4
title: "Puerta previa a generar desde el editor (render, 3D, recorrido)"
status: completed
priority: P2
effort: "1d"
dependencies: [1]
---

# Phase 4: Puerta previa en el editor

## Goal
Antes de cada generación de pago que parte del editor v2, Jev puntúa la **salud
estructural** del documento y su decisión gobierna la llamada:

- `proceed`: se genera sin fricción;
- `confirm`: el usuario ve los motivos y debe confirmar (`qualityAck`); el servidor
  reevalúa y solo acepta el ack si la decisión sigue siendo `confirm`;
- `block`: no se llama al modelo de imagen ni se cobra; error amigable con motivos.

La evaluación se cachea por `evidenceHash`: un documento sin cambios no se
reevalúa (ni se paga otra llamada a Jev).

## Scout (hecho)
- Acciones de pago del editor v2 en `src/app/(app)/projects/[id]/_actions/agent-actions.ts`:
  - `generateDesignFromEditor` (imagen por el orquestador), `proposeNativeDesignFromEditor`
    (chat de visión, consume créditos), `generateConceptRenderFromEditor` (adaptador de
    imagen KIE) — las tres reciben el `EditorDocument` del cliente y lo validan con
    `parseEditorDocument`.
  - `generateViewFrom3D` recibe una captura del visor 3D **legacy**
    (`src/components/canvas/3d/plan-3d-overlay.tsx`), no un `EditorDocument`. Se le pone la
    misma puerta, pero sobre el documento v2 guardado del proyecto/zona; si ese proyecto aún
    no tiene editor v2 activado, no hay salud estructural que juzgar y la puerta no aplica.
  - `saveNativeRender` y `estimateConceptRenderFromEditor` no llaman a IA: quedan fuera.
- Documento guardado: `withEditorDocuments(ctx).load({projectId, zoneId})` en
  `src/server/editor/document-repo.ts` (valida pertenencia a la org).
- Geometría reutilizable (pura): `deriveRooms`/`deriveRoomsSafe`, `assertPlanarTopology`,
  `buildingDocuments`, `wallPoints`, `buildEditorRenderContract`.
- UI: `EditorGenerateDialog` (612 líneas) ← `editor-shell.tsx` ← `editor-session.tsx`, que
  es quien llama a las Server Actions.

## Files
- `src/lib/quality-verdict.ts` (nuevo): veredicto compartido cliente/servidor.
- `src/lib/studio-state.ts`: reexporta el veredicto compartido (sin cambio de forma).
- `src/server/quality/evidence/editor-evidence.ts` (nuevo): `buildEditorEvidence`, pura.
- `src/server/quality/checkpoints.ts`: punto de control `editor_structure`.
- `src/server/quality/evaluate.ts`: `evaluateCheckpointCached` (caché por `evidenceHash`).
- `src/server/quality/editor-gate.ts` (nuevo): `assertEditorQuality` y `editorDocumentQuality`.
- `src/server/quality/evaluate-editor-quality.ts` (nuevo): Server Action del diálogo.
- `src/app/(app)/projects/[id]/_actions/agent-actions.ts`: puerta en las cuatro acciones.
- `src/components/quality/quality-verdict-card.tsx` (nuevo): tarjeta compartida.
- `src/components/plano-studio/plan-quality-card.tsx`: usa la tarjeta compartida.
- `src/components/editor-v2/editor-quality-gate.tsx` (nuevo): tarjeta + ack en el diálogo.
- `src/components/editor-v2/editor-generate-dialog.tsx`, `editor-shell.tsx`,
  `session/editor-session.tsx`: cableado del ack.
- `prisma/migrations/20260923160000_ai_quality_evidence_index/` (nuevo): índice de caché.
- `tests/quality/editor-evidence.test.ts`, `tests/quality/editor-gate.test.ts` (nuevos).

## Tasks
1. Evidencia pura del editor: estancias derivables/cerradas, topología planar, muros
   degenerados y extremos sueltos, huecos sin muro o fuera del muro, escala conocida,
   coherencia de escaleras/rampas/plataformas, conteos del contrato estructural.
2. Punto de control `editor_structure` (preguntas atómicas en inglés, motivos en español).
3. Caché por `evidenceHash` + índice en BD.
4. `assertEditorQuality(ctx, projectId, zoneId, document, ack)` reutilizable (también para
   el futuro recorrido/vídeo) y cableado en las cuatro acciones, **antes** de resolver el
   adaptador de imagen o de visión.
5. Server Action `evaluateEditorQuality(projectId, zoneId)` sin coste de imagen.
6. UI del diálogo: tarjeta de calidad al abrir, casilla de confirmación en `confirm`,
   generación desactivada con motivos en `block`.

## Verification
- `npx tsc --noEmit -p .` limpio y eslint sin errores.
- Tests nuevos: evidencia sana vs rota; puerta en `proceed` / `confirm` sin ack (rechaza) /
  `confirm` con ack / `block` (no se llama al adaptador de imagen) / Jev caído (fail-closed);
  caché por `evidenceHash` (una sola llamada a Jev).
- Suite completa en verde sobre `habiteka_test_editor_v2`.

## Riesgo y reversión
El riesgo es bloquear a un usuario con un plano correcto: las bandas son ajustables desde el
admin y el fallo de Jev nunca bloquea (cae a `confirm`). Revertir es quitar las llamadas a
`assertEditorQuality` de las cuatro acciones; nada más depende de la puerta.
