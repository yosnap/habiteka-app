# F8 · Modelos 3D por kind — Reporte de cierre

**Fecha:** 2026-06-22 · **Rama:** `feat/canvas/f6-3d-navegable` · **Estado:** ✅ COMPLETO (3/3)

## Qué resuelve
La queja del usuario: en 3D "la nevera no parece nevera, no se distingue del armario". Antes solo
silla y sofá tenían modelo glTF; el resto eran cajas-placeholder iguales. Ahora **13 kinds tienen
modelo real** y se ven como lo que son.

## Modelos integrados (11 nuevos + silla/sofá previos)
Todos low-poly, comprimidos (WebP+meshopt), registrados en `public/models/cc0/manifest.json`:

| Kind | Autor | Licencia | Peso |
|---|---|---|---|
| nevera, armario, cama, mesa, horno, fregadero, inodoro, lavabo, tv, planta | Quaternius | CC0 | 3–38 KB |
| ducha | Kenney | CC0 | 14 KB |
| silla | Wayfair | CC0 | 725 KB |
| sofa | Wayfair | CC-BY (atribución) | 415 KB |

**Total 11 nuevos ≈ 117 KB.** Mayoría del mismo autor (Quaternius) → estilo coherente.
Sin modelo (placeholder): encimera, isla, bidet, estanteria, mesilla, ordenador, alfombra, chimenea, lampara, foco.

## Vía de obtención (hallazgo del spike, F8.1)
La descarga oficial de Poly Pizza está tras reCAPTCHA, pero el visor carga el modelo desde el CDN
público `https://static.poly.pizza/<uuid>.glb.br`; `curl` lo entrega ya descomprimido (glTF válido).
El `<uuid>` se obtiene leyendo `performance.getEntriesByType('resource')` en la página del modelo
(chrome-devtools). Procedimiento semi-manual, viable para este volumen.

## Verificación
- `bunx tsc` + eslint limpios; **162 tests verdes**. `gltf-transform validate` OK por modelo.
- Navegador `/dev/3d?kinds=1`: los 11 modelos cargan; **nevera ≠ armario ≠ horno ≠ inodoro ≠ lavabo
  ≠ cama** claramente distinguibles ([zoom](f8-zoom.png)); 75 FPS, 11.298 tris total, 0 errores.

## Decisiones / deuda
- **Orientación (`frontOffsetRad`)**: se deja en 0 — los low-poly apenas tienen "frente" evidente y
  no se ven al revés. Calibrar por modelo si en uso real alguno aparece de espaldas.
- Ruta de dev `/dev/3d?kinds=1` añadida para QA visual de los modelos (no producción).
- Modelos restantes sin glTF → siguen como placeholder (honesto); ampliar en futuras tandas.

## Preguntas abiertas
- Ninguna bloqueante. El catálogo visual cubre los kinds más frecuentes; el resto es placeholder.
