---
title: "Inmersión del diseño aprobado y vídeos del inmueble"
description: "Unificar el diseño editable en una escena 3D aprobada, recorrerla libremente y exportar vídeos coherentes con ella."
status: superseded
priority: P1
effort: "Por estimar tras prueba de rendimiento y cobertura"
tags: [feature, frontend, video, 3d]
created: 2026-09-24
---

# Inmersión del diseño aprobado y vídeos del inmueble

**Plan sustituido:** sus fases y criterios se siguen únicamente en las fases 3–5 del [plan integral vigente](../260924-1459-flujo-integral-plano-diseno-inmersion-video/plan.md) y en el [roadmap](../260927-0135-auditoria-checks-y-roadmap-habiteka/plan.md). La tabla inferior es una correspondencia histórica, no trabajo adicional pendiente.

## Resumen

Cuando se redactó este plan, el Editor v2 ya tenía documento por plantas, escena Three/R3F, rutas y MP4 local, pero aún no unía aprobación, visita libre y vídeo. Esa unión básica ya se implementó; la calidad y la validación restantes se siguen en el plan integral. Este documento conserva el contexto del [plan de recorridos visuales](../260916-0135-plano-importado-y-recorridos-visuales/plan.md).

## Decisión de arquitectura

| Alternativa | Resultado | Coste y encaje |
|---|---|---|
| Three.js + React Three Fiber existentes | Escena ligera, navegación libre y vídeo nativo sobre `EditorDocument` | **Recomendada**; amplía código y activos ya presentes. |
| Motor de juego web adicional | Requiere exportar/sincronizar la escena y cargar otro runtime | Solo si una prueba demuestra que la calidad/rendimiento deseados no caben en la arquitectura actual. |
| Unreal por streaming | Gráficos más exigentes en servidor y vídeo interactivo al navegador | Infraestructura GPU y coste por sesión; inadecuado como primer paso para una visita ligera. |

No se puede obtener un 3D continuo y fiable pegando renders IA de diferentes cámaras. Esa es una inferencia técnica a partir del contrato actual: cada render es un archivo de imagen; la geometría, las superficies ocultas y los objetos persistentes viven en el documento, no en los píxeles. Si el resultado aceptado solo existe en imágenes, hay que convertir sus decisiones visuales a materiales/objetos 3D y validarlas.

## Flujo de producto

1. Crear el plano y aplicar propuestas editables al interior, al exterior o a estancias concretas; componerlas en una sola escena 3D. Las imágenes generadas ayudan a revisar el estilo.
2. Comparar la escena conjunta desde exterior, cenital e interiores; corregir diferencias de materiales, muebles y geometría y aprobar una revisión final identificable.
3. Entrar en la visita libre **de esa revisión aprobada** y recorrer el diseño terminado; una ruta guiada es una ayuda distinta de la exploración libre.
4. Crear por separado un vídeo automático **de esa misma revisión**: terreno vacío, aparición por etapas del edificio y sus acabados, vuelo exterior tipo dron de la casa terminada y entrada/paseo interior dirigidos. El MP4 de recorrido y el montaje breve existentes son bases técnicas, no este entregable final.

Las vistas adicionales se recomiendan para descubrir rincones o verificar la coherencia visual. No son una condición geométrica para moverse entre estancias. La cobertura mínima depende de un modelo completo y conexiones transitables.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Diseño 3D aprobado y cobertura](./phase-01-diseno-3d-aprobado.md) | Integrada en fase 3 del plan vigente; abierta |
| 2 | [Navegación libre por el inmueble](./phase-02-navegacion-libre.md) | Integrada en fase 4; pendiente de validar el diseño final |
| 3 | [Cámara cinematográfica y vídeos](./phase-03-video-publicitario.md) | Integrada en fase 5; pendiente de la película final |

## Criterios trasladados al plan vigente

- Vincular la visita y los vídeos a la misma revisión aprobada, preservando las imágenes como referencias asociadas y señalando cambios posteriores.
- Recorrer estancias, plantas y exteriores transitables sin atravesar sólidos, dentro del diseño terminado.
- Generar la película de construcción, vuelo exterior y entrada/paseo desde esa revisión; un MP4 de paseo por sí solo no cierra el criterio.
- No presentar imágenes generadas como geometría 3D navegable ni como prueba de fidelidad de la escena.

## Límites y decisiones pendientes

- Definir si «aprobar» implica publicar al cliente o solo congelar una versión interna; el diseño técnico admite ambos estados.
- Medir un inmueble real representativo para fijar presupuesto de carga y FPS. El mayor riesgo de peso son modelos/texturas e iluminación, no la ausencia de un motor de juego.
- Fijar si el primer vídeo publicitario necesita voz/música y montaje o basta el recorrido visual; la exportación nativa existente es silenciosa.

## Fuentes técnicas consultadas (24/09/2026)

- [Three.js: controles de primera persona](https://threejs.org/docs/pages/PointerLockControls.html).
- [R3F: escalado de rendimiento](https://r3f.docs.pmnd.rs/advanced/scaling-performance).
- [Three.js: carga glTF y compresión](https://threejs.org/docs/pages/GLTFLoader.html).
- [Three.js: estado de WebGPU](https://threejs.org/manual/pages/webgpurenderer).
- [Unreal: infraestructura Pixel Streaming](https://dev.epicgames.com/documentation/unreal-engine/pixel-streaming-in-unreal-engine).
- [MDN: compatibilidad de VideoEncoder](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder).

<!-- slug: inmersion-diseno-aprobado -->
