---
phase: 8
title: "Zonas permitidas garantizadas (máscara + 2 pasadas) y alzados sin muro delantero"
status: in-review
priority: P1
effort: "1d"
dependencies: [7]
---

# Phase 8: Zonas permitidas y alzados

## Implementado el 2026-09-23 (22:00), pendiente de prueba en navegador de Paulo
Paulo dio el «sí» a máscara + 2 pasadas. Suite: 260 ficheros / 1667 tests en verde; tsc limpio.
- **Alzados** (`captureCutaway` en `ceiling-scene-utils.ts`): las capturas pedidas como Frontal,
  Trasera, Izquierda, Derecha o Isométrica ocultan los muros exteriores hacia la cámara solo durante la
  captura. «Vista actual», el PNG nativo, la cenital y el dron respetan el botón «Interior» del usuario.
- **Máscara** (`scene/zone-mask.ts`): con zonas y libertad ≠ estricta, cada captura trae `maskDataUrl`.
  Se dibuja con un `overrideMaterial` que pinta de blanco cada píxel visible cuya posición en planta cae
  dentro de una zona (con un margen de 5 cm para las caras interiores de sus muros). La oclusión sale del
  depth buffer y la cámara es la misma, así que casa píxel a píxel con la captura.
- **Dos pasadas** (`server/agent/editor-v2/zone-composite-render.ts`): base estricta sin adiciones +
  diseño, con la misma semilla y en paralelo. Se componen en **servidor con sharp** (no en cliente: una
  sola acción, sin subir la imagen compuesta), con borde difuminado (σ ≈ 0,6 % del lado mayor), y se
  guardan en `renders/zones/*.jpg`. Si la zona no se ve (< 0,5 %) solo se paga la base; si ocupa toda la
  imagen (> 99,5 %), solo el diseño. `generation.zoneComposite` registra el modo y la cobertura.
- **Vistas de referencia**: la zona permitida se ve teñida de verde (`zone-overlay-image.tsx`, CSS
  `mask-image` con la misma máscara); al modelo le llega la captura limpia.
- `readRenderReference` se movió a `server/agent/editor-v2/render-asset-reader.ts` (agent-actions.ts
  rozaba las 1000 líneas).

- **Corrección tras la prueba de Paulo (22:00):** el recorte de alzados no llegaba a la foto (flushSync no
  sincroniza el reconciliador de R3F y el 3D dibuja bajo demanda). Ahora la captura oculta ella misma los
  muros exteriores hacia la cámara (`hideWallsFacingCamera`) y los restaura.
- **Porqué de la fiabilidad para el usuario final:** con fiabilidad media sin ningún «no» claro de Jev se
  muestran las 2 dudas que más restan (`doubt` por pregunta) y, en todo punto de control con `explain`, los
  hechos medidos del plano (extremos sueltos, medidas sin escala, huecos fuera de muro…). También se aplica
  al reutilizar la caché. Casillas de confirmación a tamaño fijo.

- **Solo la zona en cada vista (22:15):** con zonas, los ángulos pedidos (dron, isométrica, cenital,
  alzados) encuadran la caja de la zona (`zone-framing.ts`, `CameraRequest.focus`) y recortan lo de fuera
  con planos de corte globales del renderer (margen 0,3 m para conservar los muros que la cierran). En los
  alzados, el corte del lado de la cámara pasa por el borde de la zona: ningún muro, exterior ni interior,
  la tapa. La máscara respeta los mismos cortes. «Vista actual» no cambia.

- **Maqueta seccionada (23:10):** las vistas desde fuera (alzados, isométrica, dron, cenital o cámara libre
  con muros recortados) llevan `SECTION_VIEW_RULE`: el borde del corte es el límite y no se prolongan suelo,
  paredes ni techo hacia la cámara. Prompt `habiteka-selected-view-v2`.
- **Exterior terminado (27/09):** cuando una sola planta tiene todas las estancias interiores cubiertas,
  las capturas frontal/trasera/laterales/dron muestran fachada y techo sólidos y llevan una regla de
  exterior terminado; las maquetas abiertas mantienen la regla de sección. Se verificó la referencia
  de FInca y un render de dron. La IA aún añadió terreno y árboles ausentes del 3D, por lo que esa imagen
  no demuestra fidelidad suficiente para aprobar el diseño.
- **Prompt compacto de vistas exteriores bajo el tope (23:25):** ids de estancia abreviados (`r0`…),
  valores comunes por planta (`wallDefaults`/`ceilingDefaults`/`floorDefaults`), política de techos condensada
  y, solo si aún no cabe, sin contornos de estancia/techo y luces resumidas por estancia. Plano real de Paulo
  (6 techos, 15 luces): 5600 → ~4757 caracteres.

### Qué probar en local
1. Zona = salón-cocina, libertad libre, vista general → fuera de la zona no aparece nada nuevo.
2. Al preparar, las miniaturas muestran la zona en verde y coincide con lo que se ve.
3. Alzado Frontal/Izquierda con «Muros» activo → la captura muestra el interior, no la fachada.
4. Vista en la que la zona no se ve → una sola generación (coste de 0,08 $).

## Estado al cerrar la sesión del 2026-09-23 (21:15)
Rama `feat/jev-capa-calidad` SIN commitear (Paulo prueba en local; merge solo local, nunca en GitHub).
Suite: 258 ficheros / 1656 tests en verde; tsc limpio. Proyecto de prueba local:
`cmue9wewy000kjmmsgkhgdvoj` («Prueba vistas realistas Jev»), plano real de Paulo, Jev 95 % / 93 %.

Hecho y probado en navegador en esta sesión:
- Vistas interiores por estancia (cámara dentro, 1,6 m), amueblado por prompt (`interiorFurnishingRule`),
  baño incluido por uso, diálogo que espera al 3D (sin cuelgues), «Diseñar con IA» en 2D conmuta a 3D.
- Render por defecto **Flare** (0,08 $) — A/B real vs Sunburst (0,15 $): calidad equivalente.
  Config local ya en Flare; perfil `gpt_25_architecture_validation` actualizado. Inpaint sigue en Sunburst.
- «Reintentar pendientes» arreglado: `sanitizeOwnRenderBuffer` reduce renders propios >2048 px.
- Prompt compacto interior ≤ 4800 caracteres (FLUX de respaldo ya no falla por longitud).
- Selector de zonas con modos Estancia / Punto a punto / Rectángulo (funciona).
- 3D del editor abre con todos los muros visibles («Muros»); «Interior» es manual.

## Problemas confirmados (pendientes)
1. **Zonas permitidas NO se respetan** (probado: zona = salón-cocina, vista general Flare → amuebló
   dormitorios y baño). Solo viajan como texto en el prompt; KIE no admite máscara.
   Solución acordada con Paulo (pendiente de su «sí» final): máscara exacta dibujada por el 3D desde la
   misma cámara (respeta oclusión) + 2 pasadas por vista (base estricta + diseño) + composición en
   cliente con borde suavizado. Coste 0,16 $/vista solo con zonas; «Toda la planta» sigue a 0,08 $.
2. **Las vistas de referencia no muestran la zona permitida** → superponer la máscara/contorno en cada
   captura de referencia (misma máscara del punto 1).
3. **Alzados tapados por el muro delantero** (Frontal/Izquierda salen como fachada): en capturas de
   alzado (front/back/left/right, y valorar isométrica/dron) ocultar automáticamente los muros exteriores
   que miran a la cámara SOLO en la captura (`cutawayWallIds` ya existe en `RenderView`); el 3D de trabajo
   sigue con todos los muros.

## Notas de entorno
- El Chrome del usuario tiene un gestor de contraseñas que inyecta un iframe sobre inputs con foco y
  bloquea la automatización (`chrome-extension://…`). Usar el MCP `chrome-devtools` con
  `isolatedContext` y «Entrar como admin (dev)» en la home (sin contraseña).
- Chrome pausa rAF en pestañas ocultas: la captura 3D necesita la pestaña visible.
- Los cambios de código con HMR interrumpen generaciones en curso: no editar mientras se genera.
