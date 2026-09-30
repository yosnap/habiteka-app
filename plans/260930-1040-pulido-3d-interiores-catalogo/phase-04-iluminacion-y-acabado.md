---
title: "Fase 4: Iluminación y acabado"
status: todo
---

# Fase 4: Iluminación y acabado

## Contexto

`SceneLighting` (`src/components/editor-v2/scene/scene-lighting.tsx:23-47`): una direccional con
sombra 2048 + hemisférica por preset (`daylight`, `warm`, `evening`). `SceneEnvironment`
(`scene-environment.tsx:13-37`): `RoomEnvironment` PMREM con intensidad .15-.24, sin HDRI.
Canvas: `frameloop="demand"`, `shadows="percentage"`, `dpr [1,1.5]`, `preserveDrawingBuffer`
(`editor-scene-view.tsx:601`), `toneMappingExposure .9` (`:229`). Las capturas leen el canvas
tras el render bajo demanda; las luminarias del documento ya emiten con presupuesto
(`ceiling-scene-utils`, `MAX_LUMINAIRE_LIGHTS`, `MAX_SHADOW_LIGHTS`). No hay post-procesado,
sombras de contacto ni AO de pantalla.

## Requisitos

- Tres niveles de calidad `basic | standard | high` en preferencias del editor
  (`src/components/editor-v2/editor-preferences.ts`), con detección inicial por
  `gl.capabilities`/móvil y control manual en el menú «Vista».
- `standard` (por defecto, sin post-procesado): HDRI por preset (Poly Haven CC0, 1K `.hdr`,
  ~1,5 MB: día = interior neutro tipo `studio_small_09`, cálido = `kloofendal_48d_partly_cloudy`,
  noche = `moonless_golf`) como `scene.environment` + fondo de color actual; PCSS (`SoftShadows`
  de drei) para el sol; sombras de contacto por mueble (`ContactShadows` de drei bajo cada
  estancia, resolución 512, `frames=1` con `frameloop="demand"` recalculado al invalidar);
  materiales emisivos de lámparas (`emissiveMaterials` del manifiesto, intensidad 3 en
  `warm/evening`, 0.6 en `daylight`) con halo `sprite` aditivo; tono ACES con exposición por
  preset (día .95, cálido 1.05, noche .8) y `Color` de fondo por preset (ya existe).
- `high` (escritorio): `@react-three/postprocessing` con `N8AO` (paquete `n8ao`), `Bloom`
  (umbral 1.0, solo emisivos) y `SMAA`; desactivado en móvil y durante captura si la validación
  del paso 5 falla.
- `basic` (móvil o GPU débil): sin PCSS ni contacto, sombra 1024, sin HDRI (RoomEnvironment).
- Presupuesto: `standard` debe mantener ≥ 60 fps escritorio / ≥ 30 móvil en el plano de
  referencia; `high` ≥ 45 fps escritorio.

## Archivos

- `public/hdri/{daylight,warm,evening}.hdr` + entrada en un `public/hdri/manifest.json` (licencia,
  fuente, hash) validada por `validate-model-manifest.mjs --hdri`.
- Nuevo `src/components/editor-v2/scene/scene-quality.ts` (≤ 80 líneas): tipo `SceneQuality`,
  detección (`isMobile`, `maxTextureSize`, `renderer.capabilities`), tabla de parámetros por
  nivel (mapSize, pcss, contact, hdri, post).
- `scene-environment.tsx`: cargar HDRI con `useLoader(RGBELoader)` + PMREM cuando
  `quality.hdri`; fallback `RoomEnvironment`; `environmentIntensity` por preset (día .6, cálido
  .5, noche .25) recalibrado en la prueba de referencia.
- `scene-lighting.tsx`: `SoftShadows` condicionado; mapSize por nivel; exposición por preset
  movida aquí desde `editor-scene-view.tsx:229` (una línea menos allí).
- Nuevo `src/components/editor-v2/scene/scene-post-processing.tsx` (≤ 100 líneas): `EffectComposer`
  con N8AO/Bloom/SMAA solo en `high`; `enabled={!capturing || captureAllowsPost}`.
- Nuevo `src/components/editor-v2/scene/furniture-contact-shadow.tsx` (≤ 60 líneas): un
  `ContactShadows` por estancia interior, tamaño = bbox de la estancia, altura del suelo
  (`floorFinish.elevationMm`).
- `src/components/editor-v2/scene/furniture-model.tsx`: aplicar `emissiveMaterials` y halo.
- `editor-scene-view.tsx`: montar `<ScenePostProcessing>` y `<FurnitureContactShadow>` (2 líneas)
  y pasar `quality` desde preferencias.
- Menú Vista (`scene-view-controls.tsx`): selector de calidad con `ModernSelect`.
- Tests: `tests/editor-v2/scene-quality.test.ts` (detección y tabla), `tests/editor-v2/
  editor-preferences.test.ts` (existe: nuevo campo), `tests/editor-v2/cutaway-capture.test.ts`
  (existe: la captura sigue devolviendo imagen con post activado/desactivado).

## Pasos

1. `scene-quality.ts` + preferencia + selector.
2. HDRI: descargar 3 `.hdr` 1K, manifiesto, `scene-environment.tsx`; calibrar exposición e
   intensidad con C4, C6, C7 (comparar histograma medio con las capturas de Planner 5D: ni
   sobreexpuesto ni gris).
3. PCSS + sombras de contacto; comprobar en C5 y C10 que los muebles «apoyan» en el suelo.
4. Emisivos de lámparas (+ halo) en `warm` y `evening`; C9 con lámpara colgante.
5. Post-procesado `high`: validar captura (`CaptureScene`) con composer: la imagen debe salir del
   composer, no del `gl.domElement` sin efectos; si `preserveDrawingBuffer` + composer no
   devuelve la imagen, capturar con `gl.readRenderTargetPixels` del target final. Validar también
   `hideWallsFacingCamera` y `clipShaderAboveSupport` (`cutaway-wall.tsx:20,44`) con N8AO (la
   profundidad de los muros descartados no debe ensuciar la AO).
6. Medir fps por nivel con el script de la fase 0; ajustar mapSize/resoluciones hasta cumplir.
7. Prueba de referencia: objetivo ≥ +15 en «Iluminación y sombras» y ≥ +5 en «Coherencia».

## Validación

- Tests verdes; `pnpm build`; captura y vídeo nativo (`offline-recorder`) funcionan en los 3
  niveles (grabar 5 s de prueba).
- `metrics.json` por nivel dentro del presupuesto de la fase 0.
- Visita libre en móvil de referencia ≥ 30 fps en `basic` y `standard`.

## Riesgos (alto)

- Post-procesado + `frameloop="demand"` + captura: el composer necesita `invalidate()` y un
  fotograma completo antes de leer píxeles; envolver la captura en `await` de un frame. Si no se
  estabiliza en 1 día, dejar `high` detrás de flag oculto y cerrar la fase con `standard`.
- Shaders personalizados (`clipShaderAboveSupport`) y `Edges` de selección con SMAA: verificar
  visualmente.
- `ContactShadows` renderiza la escena desde abajo: excluir muros/techos con `layers` para no
  pagar el coste completo; `frames=1` y recomputar solo al cambiar el documento.
- Presupuesto de samplers: cada luz con sombra suma texturas; mantener `MAX_SHADOW_LIGHTS`.

## Rollback

`quality = basic` restaura el comportamiento actual (RoomEnvironment, 1 sombra, sin post). El
selector permite volver sin desplegar; el código nuevo se desmonta con 2 líneas.

## Decisiones para Paulo

- Aceptar dependencia de post-procesado (decisión 2) o cerrar con `standard`.
