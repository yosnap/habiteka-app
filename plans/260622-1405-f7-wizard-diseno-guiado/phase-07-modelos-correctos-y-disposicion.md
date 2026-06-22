---
phase: 7
title: "Modelos correctos y disposicion"
status: pending
effort: ""
---

# Phase 7: Modelos correctos y disposicion

## Overview

Curar la calidad visual: corregir el mapa kind→glTF (lámpara = interior, no farola), añadir
modelos adecuados para kinds comunes donde sea viable, y asegurar que los ejemplos/seed tengan
disposición coherente. Placeholder honesto donde no haya modelo.

## Architecture
- **Lámpara (claim corregido — red-team #10):** el mapa NO contiene "lampara → Lantern"; contiene
  `lampara: { url: '/models/cc0/lampara.glb' }` (furniture-models.ts:23), y **el archivo `lampara.glb`
  ES el modelo Lantern renombrado** (sus meshes internos son `LanternPost_Mat`/`LanternPole_Body`). La
  tarea real es: inspeccionar/REEMPLAZAR el archivo `public/models/cc0/lampara.glb` por una lámpara de
  interior CC0 (descargable directo, comprimida como en F6.5), o **devolver `lampara` a placeholder
  quitando la entrada del mapa**. Buscar el string "Lantern" en el código sería un no-op.
- **Procedencia/integridad de assets (red-team #12, supply chain):** por cada `.glb` nuevo, registrar en
  un MANIFIESTO ESTRUCTURADO (no comentario) {url origen, fecha, SHA-256, licencia, autor}; verificar el
  hash tras descargar y tras comprimir; correr `gltf-transform validate` antes de commitear. Bloquear si
  la licencia no es verificable. Mantener atribución de los CC-BY.
- **Ampliar mapa** (oportunista): modelos CC0 para cama/mesa/silla(ya)/inodoro/... si hay descargables
  buenos y ligeros. No bloquear F7 por esto; placeholder cubre el resto.
- **Disposición**: revisar `examples.ts`/seed para que las disposiciones sean realistas (apoyarse en
  las plantillas de la fase 5 para regenerarlas con sentido).
- Reusar el pipeline de compresión de F6.5 (`@gltf-transform/cli` WebP+meshopt) para todo asset nuevo.

## Related Code Files
- Modify: `src/canvas/3d/furniture-models.ts` (corregir lámpara; añadir entradas).
- Add/optimize: `public/models/cc0/*.glb` (assets nuevos, comprimidos).
- Posible modify: `src/canvas/examples.ts` / `prisma/dev-seed.ts` (disposición coherente).

## Implementation Steps
1. Resolver la lámpara (interior CC0 o placeholder); comprimir si se añade modelo.
2. Añadir 2-4 modelos CC0 comunes si hay buenos candidatos ligeros; si no, anotar y placeholder.
3. Revisar ejemplos/seed para disposición coherente (reusar plantillas de fase 5).
4. Verificar en 3D: ningún modelo "fuera de lugar"; placeholders claros donde falte.

## Success Criteria
- [ ] Lámpara ya no es una farola (modelo de interior o placeholder).
- [ ] Mapa kind→glTF coherente; assets nuevos comprimidos (peso controlado).
- [ ] Ejemplos/seed con disposición realista.
- [ ] tsc + eslint + vitest verdes.

## Risk Assessment
- No expandir el catálogo 3D sin control de peso (F6.5 mostró que las texturas dominan). Comprimir todo.
- Licencias: solo CC0/CC-BY con atribución registrada en el mapa.
