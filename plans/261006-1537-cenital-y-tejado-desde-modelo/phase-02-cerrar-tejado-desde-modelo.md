---
phase: 2
title: "Cerrar el tejado desde el modelo sobre una isométrica o un dron aceptados"
status: completed
priority: P1
effort: "6h"
dependencies: [1]
---

# Fase 2: cerrar el tejado desde el modelo

## Objetivo

A partir de una isométrica o un dron aceptados, crear una imagen nueva con la cubierta del modelo. La forma se proyecta desde la misma cámara y la IA solo retoca la cubierta para darle realismo. Fuera de la cubierta, los píxeles de la imagen aceptada se conservan.

## Decisiones (acordadas con Paulo el 06/10)

- La cubierta no se diseña con IA. Su tipo, pendiente, alero, material, claraboya y chimenea vienen del modelo.
- No se pega el render 3D como resultado final. La guía se proyecta sobre la imagen aceptada y el retoque se limita a su máscara. La imagen nueva requiere aceptación del usuario.
- La proyección se hace en el servidor, con la cámara guardada en `generation.view`. Así no depende del tamaño de la ventana del editor.

## Cambio de enfoque (06/10, 19:30, acordado con Paulo)

La prueba con isométricas reales demostró que el generador puede reencuadrar la vista: la cubierta proyectada con la cámara guardada no encajaba sobre los muros dibujados. Se sustituyó el retoque con máscara por una **edición guiada**:

1. Una maqueta del modelo (muros, huecos y cubierta) proyectada desde la cámara de la imagen y recortada al inmueble (`projectRoofModel` y `roofModelGuidePng`).
2. La generación (`render3d`) recibe la imagen aceptada y la maqueta, con el prompt `habiteka-roof-closure-v2`.
3. Una revisión de visión propia (cubierta, encuadre, identidad y realismo) descarta la imagen si algo falla o es dudoso. Si la revisión no se completa, la imagen se guarda descartada.

Se retiraron la máscara, la composición y el soporte de `editMask` en `protectedInpaint`. Ya no se garantiza la conservación píxel a píxel fuera de la cubierta; esa comprobación pasa a la revisión y a la aceptación del usuario.

## Evidencias

- La isométrica y el dron se capturan sin cortar muros (`cut = aerialCapture ? false`, `editor-scene-view.tsx`) y con `ceilingView: 'hidden'`. Los muros están completos y la cubierta encaja encima.
- «Exterior terminado» usa la misma cámara oblicua que la isométrica.
- `exteriorRoofGeometry(doc)` devuelve las facetas en metros de escena (positions, indices), con las piezas `glazing`, `frame` y `chimney` y los cierres de muro (`wallClosures`). `ExteriorRoofMeshes` las pinta sin transformación en la planta activa.
- `fitRenderReferenceAspect` añade bandas centradas hasta la proporción de salida más cercana (`OUTPUT_RATIOS`).
- `protectedInpaint` sustituye solo los píxeles blancos de la máscara y verifica la proporción. Hoy construye la máscara desde `zone`; `InpaintRequest.editMask` ya existe en el contrato.
- El vídeo de construcción exige una referencia con `closedRoof` (`ceilingView === 'solid' && !cutaway`) y la misma tanda (`batchId`).

## Ficheros

- Crear: `src/server/agent/editor-v2/roof-closure-projection.ts`. Proyecta la cubierta con `PerspectiveCamera` (three), descarta caras traseras, ordena por profundidad y aplica la transformación de bandas. Devuelve polígonos normalizados con su tipo y sombreado, una guía SVG y una máscara PNG dilatada.
- Crear: `src/server/agent/editor-v2/roof-closure-prompt.ts`, con el prompt de retoque (tipo, pendiente, alero, acabado, claraboya y chimenea, misma luz y perspectiva).
- Crear: `src/app/(app)/projects/[id]/_actions/roof-closure-actions.ts`, con la acción `closeRoofFromModel(projectId, zoneId, deliverableId)`. `agent-actions.ts` ya tiene 990 líneas.
- Crear: `src/components/editor-v2/roof-closure-button.tsx`, el botón «Cerrar tejado desde el modelo» con el coste y el estado.
- Modificar: `src/server/ai/image/protected-inpaint.ts`, para usar `request.editMask` si llega del servidor, y la ventana desde la caja de la zona.
- Modificar: `src/server/agent/editor-v2/render-reference-frame.ts`, para exportar la proporción elegida (`fittedOutputRatio`).
- Modificar: `src/components/deliverables/render-image-dialog.tsx`, para mostrar el botón en «Acciones de imagen» cuando proceda.
- Modificar: `src/lib/editor-document/design-video-readiness.ts` y `src/server/walkthrough/design-video-actions.ts`, para que los mensajes nombren la nueva opción además de «Exterior terminado».
- Tests: `tests/agent/roof-closure-projection.test.ts` y `tests/ai/protected-inpaint-mask.test.ts`. El nombre se ajustará a la carpeta existente.
- Docs: `docs/site/src/content/docs/guias/imagenes.md`, `videos/estudio.md` y `ayuda/novedades.md`.

## Pasos

1. Proyección (pura y testeable):
   - Reconstruir la cámara a partir de `position`, `quaternion`, `fov` y `aspect`.
   - Proyectar cada triángulo de `exteriorRoofGeometry` y de sus `wallClosures`, descartar las caras que miran hacia atrás y fusionar por pieza.
   - Ordenar por profundidad media (pintor), aplicar las bandas de `fitRenderReferenceAspect` y normalizar.
   - Sombrear cada faceta con una luz fija; la claraboya va translúcida sobre la imagen base y la chimenea va en ladrillo claro.
   - Máscara = unión de las facetas, dilatada unos 0,6 % del lado mayor para cubrir pequeños desajustes de alero.
   - Rechazos: sin cubierta, cubierta inválida, vista con `allLevels`, inmuebles con varias plantas o máscara vacía o fuera de cuadro.
2. `protectedInpaint`: si `request.editMask` existe, decodificarla y redimensionarla al tamaño de la base con umbral 128. La ventana y la zona salen de la caja normalizada de la máscara.
3. Acción `closeRoofFromModel`:
   - Contexto de organización, proyecto y zona, consentimiento y ToS.
   - Cargar el entregable y exigir:
     - proveedor IA;
     - aceptado (`acceptedRenderIssue` nulo);
     - preset `isometric` o `drone`;
     - ámbito «Toda la planta» (`zoneCompositeActive` falso);
     - no interior;
     - la revisión del plano con el mismo contenido que el actual (`sameContentRevisions`);
     - una cubierta en el documento.
   - Leer los bytes de la imagen, componer la guía y la máscara al tamaño real y llamar a `getImageAdapterForAction(..., 'inpaint').inpaint` con `baseImage` = composición, `zone` = caja y `editMask`.
   - Guardar un entregable nuevo `RENDER_3D` con:
     - `view` = la base con `ceilingView: 'solid'` y `cutaway: false`;
     - las `options`, el `batchId` y la luz de la base;
     - `promptVersion: 'habiteka-roof-closure-v1'`;
     - `referenceDesignId` = la base;
     - `roofClosure` con el número de píxeles editados y protegidos.
   - Sin auditoría espacial, porque fuera de la máscara la imagen es la aceptada. Queda «Pendiente de revisar» hasta que el usuario la acepte.
4. Botón en el visor:
   - Solo con imagen aceptada, isométrica o dron, Toda la planta y cubierta en el plano.
   - Muestra que el retoque tiene coste y usa el modelo de Retoque configurado.
   - Al terminar, refresca la tanda (`router.refresh` o el callback existente) y avisa de dónde está la imagen nueva.
5. Mensajes del vídeo: «Añade “Exterior terminado” o cierra el tejado desde el modelo sobre la isométrica o el dron aceptados de esta tanda».
6. Tests:
   - La proyección de una casa de 10 × 8 m con cubierta a cuatro aguas desde una isométrica cae dentro de la imagen, cubre la parte superior de los muros y no cubre el terreno lejano.
   - Las bandas se aplican cuando la proporción no coincide.
   - La claraboya y la chimenea aparecen como piezas propias.
   - `protectedInpaint` conserva exactamente los píxeles negros de una `editMask` arbitraria (con un adaptador falso solo en el test).
7. Documentar el flujo en la guía y en las novedades.

## Verificación

- `npx vitest run tests/agent/roof-closure-projection.test.ts` y el test de `protectedInpaint`.
- `npx tsc --noEmit -p .`, `npm run lint`, `npm run docs:updates` y `npm run docs:build`.
- Reconstruir la guía sobre la isométrica real de Test 6 (cuando exista) y revisar visualmente que el tejado encaja en los muros.

## Riesgos

- Si la IA desplazó los muros unos píxeles, la cubierta queda desfasada. Lo mitiga la dilatación y que la auditoría de la base exige la geometría. Si el desfase es grande, el usuario no acepta la imagen.
- Un árbol más alto que la cubierta quedaría tapado. Riesgo menor y aceptado en esta versión.
- Si el usuario cambia la cubierta después de generar la base, `sameContentRevisions` bloquea el cierre y pide generar la vista de nuevo.
