---
title: Techos e iluminación persistidos en el editor v2
date: 2026-09-17
summary: "Techos por estancia, luminarias ancladas y propuesta local revisable; 3D y exportación comprobados."
---

# Techos e iluminación persistidos en el editor v2

## Qué cambió

El editor v2 guarda techos planos o falsos techos y luminarias en el documento v8.
La transparencia permite editar el interior y no cambia el material del render.
Las luces conservan el anclaje; las asociaciones de estancia ambiguas muestran
avisos. La propuesta moderno/mediterráneo es local determinista, revisable y
atómica, conserva luces anteriores y no consume créditos IA.

## Evidencia

QA comunicada: 232 pruebas en 38 archivos, TypeScript y build correctos. Lint de
35 archivos correcto; lint global mantiene 29 errores y 22 avisos previos.
Navegador: habitación 6 × 4 m, falso techo 15 cm, altura 2,55 m, propuesta aceptada
y guardado sincronizado. Techo/focos visibles en 3D. Exportación y guardado PNG
completados con «Render guardado en Diseños.».

La captura nativa descarga la resolución del canvas y persiste una copia con
lado máximo de 2048 px del mismo fotograma. No se recargó manualmente la pestaña
para no interferir con cambios nuevos; roundtrip/persistencia tienen tests.

## Límites y siguiente paso

Validación externa de imágenes pendiente. No hay orientación de luminarias,
foseados/tiras indirectas ni fotometría normativa. Máximo 12 emisores 3D.
Mobiliario importado sigue aplazado en issue #41. Plantilla antigua Salón comedor
con metadata no convertible: pendiente ajeno detectado durante QA.

Plan permanece in-progress. Sin commit, publicación ni despliegue.
AgentWiki publish skipped.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
