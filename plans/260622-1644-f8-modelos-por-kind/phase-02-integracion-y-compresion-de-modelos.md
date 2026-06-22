---
phase: 2
title: Integracion y compresion de modelos
status: completed
effort: ''
---

# Phase 2: Integracion y compresion de modelos

## Overview

Integrar el subset de modelos del spike: comprimir, colocar en `public/models/cc0/`, registrar en
el manifiesto y añadir al mapa `kind→glTF`. Sin tocar la lógica de render (ya soporta cualquier kind).

## Architecture
- Por cada modelo del subset: `gltf-transform optimize --texture-compress webp --texture-size 1024
  --compress meshopt` (patrón F6.5). Nombre `<kind>.glb` en `public/models/cc0/`.
- Añadir entrada a `FURNITURE_MODELS` (`furniture-models.ts`): `{ url: '/models/cc0/<kind>.glb' }`.
  `frontOffsetRad` se calibra en la fase 3 (aquí queda sin poner = 0).
- Actualizar `manifest.json`: por cada asset {file, kind, source, author, license, attributionRequired,
  sha256 (del .glb COMPRIMIDO), processing}. `gltf-transform validate` cada uno (aviso meshopt OK).
- El render (`furniture-layer.tsx`) ya normaliza por bbox a las medidas del kind y precarga selectiva
  — sin cambios. Verificar que cada modelo carga (drei decodifica meshopt/WebP, ya probado en F6).

## Related Code Files
- Add: `public/models/cc0/<kind>.glb` (comprimidos).
- Modify: `src/canvas/3d/furniture-models.ts` (entradas nuevas en el mapa).
- Modify: `public/models/cc0/manifest.json` (procedencia/licencia/SHA-256 de cada uno).

## Implementation Steps
1. Comprimir cada modelo del subset; medir peso antes/después.
2. Añadir entradas al mapa y al manifiesto; calcular SHA-256 del .glb final.
3. `gltf-transform validate` de cada asset.
4. tsc + eslint; arrancar dev server.

## Success Criteria
- [ ] Modelos del subset comprimidos en `public/models/cc0/` y en el mapa kind→glTF.
- [ ] manifest.json actualizado (licencia + SHA-256 de cada uno); atribución de los CC-BY.
- [ ] tsc + eslint limpios; el dev server arranca sin errores.

## Risk Assessment
- Peso: comprimir TODO (F6.5 mostró que las texturas dominan; WebP+resize baja ~90%). Vigilar el total.
- Licencias: solo CC0/CC-BY con atribución registrada. Bloquear cualquier asset con licencia dudosa.
