---
phase: 1
title: Spike de disponibilidad de assets
status: completed
effort: ''
---

# Phase 1: Spike de disponibilidad de assets

## Overview

Spike empírico: para cada kind objetivo, localizar un `.glb` CC0 (o CC-BY con atribución)
**descargable directo** (curl/WebFetch) y de bajo poly. El resultado es la lista real de kinds
con modelo vs placeholder — define el alcance de la fase 2. NO integrar aún; solo confirmar fuentes.

## Fuentes a probar (por orden de fiabilidad de descarga directa)
- **Khronos glTF-Sample-Assets** (`Models/<Name>/glTF-Binary/<Name>.glb`): CC0/CC-BY, curl directo.
  Pocos de mobiliario doméstico (SheenChair, GlamVelvetSofa ya usados; mirar el resto).
- **Quaternius** (GitHub / quaternius.com): packs CC0 de interior; ver si hay `.glb` sueltos por GitHub raw.
- **Poly Pizza**: CC0, pero la descarga directa por curl no fue trivial en F7.7 — reintentar con su
  patrón de URL estática si se confirma.
- **Poly Haven**: CC0, sobre todo props/decoración.

## Implementation Steps
1. Lista de kinds objetivo priorizados (los que el usuario citó: nevera, armario; + frecuentes:
   cama, inodoro, mesa, tv, lavabo, ducha, planta).
2. Por cada uno, intentar localizar y DESCARGAR a `/tmp` un `.glb` candidato (curl/WebFetch),
   anotando url, licencia y peso. NO commitear todavía.
3. Registrar en el reporte: kind → {fuente, url, licencia, peso, ¿low-poly?} o "no encontrado".
4. Decidir el subset que pasa a fase 2 (los encontrados, priorizando los citados por el usuario).

## Success Criteria
- [ ] Reporte de disponibilidad en `plans/.../reports/`: por kind, fuente/url/licencia o "no encontrado".
- [ ] Subset de kinds con modelo real decidido para la fase 2 (incluye nevera y armario si es viable).
- [ ] Candidatos descargados a /tmp para inspección (sin commitear).

## Risk Assessment
- Puede que pocos kinds tengan `.glb` CC0 directo (lección de F7.7). Mitigación: el placeholder cubre
  el resto y la fase 2 integra solo lo encontrado; no bloquear el rasgo por cobertura total.
- Estilos visuales heterogéneos entre fuentes → preferir, dentro de lo posible, un mismo origen
  (p. ej. un pack Quaternius) para coherencia; si no, aceptar mezcla en v1.
