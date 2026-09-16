---
title: "Réplica construcción manual: primer flujo 2D y 3D"
date: 2026-09-08
summary: "Megamenú, paredes encadenadas, aberturas con encaje, escaleras y proyección canónica; validación visual y plan aún en curso."
---

# Réplica construcción manual: primer flujo 2D y 3D

Megamenú, paredes encadenadas, aberturas con encaje, escaleras y proyección canónica; validación visual y plan aún en curso.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Resultado

Implementación aislada en `feat/editor-v2`: megamenú constructivo, paredes encadenadas,
contrato v3 compatible con lectura v2, aberturas ancladas y escaleras con proyección 3D.
En Comet se comprobó insertar y reubicar una puerta, recargar, ver puerta/ventana en 3D,
insertar escalera U, moverla por medidas al interior y deshacer/rehacer su posición.

## Correcciones relevantes

- Preview validaba toda la topología por movimiento: 200 muros pasaron de 74 a 0,234 ms
  en el benchmark del resolver; no equivale a una medición de FPS.
- Agarre de puerta conservado al cambiar de pared; copia provisional fuera de historia.
- Holguras angulares evitan que el muro vecino invada una abertura nueva.
- Inversión/fusión materializa defaults v2 antes de transformar bisagra y apertura.
- Pérdida de contexto 3D observada durante desarrollo: recarga recuperó; añadido reintento.

## Verificación y límites

923 pruebas aprobadas, 5 omitidas; typecheck y lint del alcance correctos.
Build de producción comprobado en copia temporal aislada, sin parar dev 3041.
Lint global mantiene 29 errores y 16 avisos previos. Plan continúa abierto:
faltan pruebas completas de gestos, ventana nueva, móvil y estrés; no afirmar paridad total.
Original sucio y plano del usuario preservados. Sin commit ni publicación.

AgentWiki publish skipped.
