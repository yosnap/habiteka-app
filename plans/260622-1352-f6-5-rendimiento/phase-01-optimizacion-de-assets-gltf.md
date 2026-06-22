---
phase: 1
title: Optimizacion de assets glTF
status: completed
effort: ''
---

# Phase 1: Optimizacion de assets glTF

## Overview

Comprimir los glTF (meshopt) y borrar el duplicado huérfano. Bajar los 16 MB de assets.

## Architecture
- `@gltf-transform/cli` 4.4 (via bunx). Pipeline por modelo: `optimize` (dedup, prune,
  resize de texturas a un máx razonable p. ej. 1024, compresión meshopt EXT_meshopt_compression).
  Meshopt sobre Draco: lo soporta three/drei (`MeshoptDecoder` / drei lo maneja vía useGLTF)
  y comprime bien geometría + permite resize de texturas. Si meshopt diera problemas en
  `useGLTF`, alternativa Draco (`KHRDracoMeshCompression`) que drei también decodifica.
- Verificar tras comprimir que `useGLTF` los carga (drei trae decoders; si falta, configurarlos).
- Borrar `public/models/kenney/sofa.glb` (huérfano del spike, sin usos — confirmado por grep).

## Related Code Files
- Optimize (in place o a `-opt.glb`): `public/models/cc0/{lampara,silla,sofa}.glb`.
- Delete: `public/models/kenney/sofa.glb` (+ carpeta `kenney/` si queda vacía).
- Posible modify: `src/components/canvas/3d/furniture-layer.tsx` si hay que activar un decoder.

## Implementation Steps
1. Medir tamaño antes (ya: 9,1 / 3,9 / 3,0 MB).
2. Por cada modelo: `bunx @gltf-transform/cli optimize in.glb out.glb --texture-compress webp`
   (o `--compress meshopt`), con resize de textura a 1024. Ajustar flags según la versión.
3. Reemplazar los .glb por las versiones optimizadas (mismos nombres → el mapa no cambia).
4. Borrar el duplicado `kenney/sofa.glb`.
5. Verificar en `/dev/3d` que los 3 modelos se siguen viendo (no romper por falta de decoder).

## Success Criteria
- [ ] Los 3 glTF notablemente más ligeros (anotar antes/después).
- [ ] Duplicado huérfano borrado.
- [ ] `/dev/3d` muestra los modelos sin errores de consola (decoders OK).
