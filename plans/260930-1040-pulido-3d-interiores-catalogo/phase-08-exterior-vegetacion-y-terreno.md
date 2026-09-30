---
title: "Fase 8: Exterior — vegetación y terreno (diferida)"
status: todo
---

# Fase 8: Exterior — vegetación y terreno (diferida)

## Contexto

Decisión de Paulo (30-09-2026): interiores primero. Esta fase solo fija el orden y las
dependencias para que no se cuele trabajo exterior antes de tiempo. El exterior ya tiene base:
`src/lib/editor-document/outdoor-catalog.ts`, `outdoor-volumes.ts`, materiales
`public/materials/outdoor`, lámina de agua (`water-surface-material.tsx`), luz exterior
(`outdoor-lighting.tsx`).

## Alcance previsto (a detallar cuando se abra)

- Árboles y arbustos con hojas reales (Poly Haven/Sketchfab CC0; instanciado obligatorio),
  césped con desplazamiento suave, setos, pérgola con vegetación.
- Terreno: relieve ligero por desnivel del documento, bordes de parcela, caminos.
- Cielo HDRI exterior por preset (reutiliza fase 4) y sombras de sol largas en `warm`.
- Presupuesto propio (la vegetación instanciada domina triángulos y overdraw).

## Dependencias

Fases 2 (pipeline y biblioteca), 4 (HDRI y calidad por niveles). Cámaras de referencia
exteriores nuevas (dron, frontal) añadidas a `camaras.json` de la fase 0 cuando se abra.

## Criterio de apertura

Prueba de referencia de interiores aprobada (≥ 70) y presupuesto cumplido.
