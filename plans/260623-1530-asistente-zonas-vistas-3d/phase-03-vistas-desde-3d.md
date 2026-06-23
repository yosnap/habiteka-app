# Fase 3 — Vistas de diseño desde la escena 3D (capturas por ángulo)

## PREDICT HECHO — veredicto GO (2026-06-23). Decisión usuario: captura 3D + estilizado IA.

## Objetivo
Que el usuario pueda ver el diseño en más de la vista cenital, generando las vistas desde la
ESCENA 3D navegable (fiel al plano), en vez de depender de que la IA adivine la vista.

## Contexto (scout)
- `Plan3DView`/`docToScene` ya construyen la escena 3D (suelo, muros, muebles glTF, luces).
- Hoy el "diseño" es una imagen de IA (`entrega.ts` prompt sin vista → cenital);
  `render3d-viewer.tsx` la muestra.
- La escena 3D es WebGL (Three/R3F): se puede capturar el canvas a imagen.

## Opciones a evaluar en el predict
1. **Capturas desde el 3D existente**: ángulos predefinidos (perspectiva, isométrica, cenital)
   + botón "capturar vista" que exporta el canvas WebGL a imagen (toDataURL / gl.readPixels) y
   la guarda como entregable/vista. Reusa la escena; barato; calidad = la del render en vivo.
2. **3D como base + estilizado IA**: capturar el 3D y pasarlo como imagen base a la IA para que
   aplique estilo/materiales (img2img). Más vistoso, depende del proveedor de imagen.
3. **Solo añadir vista al prompt** (descartada como principal): rápido pero no fiel; puede
   quedar como complemento.

## Decisión (CERRADA — predict + usuario)
- **GO** a capturar el canvas WebGL: activar `gl={{ preserveDrawingBuffer: true }}` en el
  `<Canvas>` de R3F y exportar con `gl.domElement.toDataURL()`. Sin esto la captura sale en
  negro. Medir FPS con el PerfProbe existente tras activarlo (penalización esperada baja).
- **Opción 2 (captura 3D + estilizado IA, img2img)** desde el primer PR (decisión usuario):
  la captura del 3D se pasa como IMAGEN BASE al proveedor de imagen para aplicar estilo/
  materiales fotorrealistas. RIESGO a verificar en spike: que el proveedor actual
  (Nano Banana/Gemini) acepte imagen base (img2img); si no, primer PR cae a captura cruda y el
  estilizado se difiere. Ver `nano-banana.ts`/`entrega.ts`.
- Ángulos predefinidos (perspectiva, isométrica, cenital) + guardar la vista asociada a la
  zona/Deliverable (coherente con Fase 2).

## SPIKE previo (riesgo proveedor)
Confirmar que el proveedor de imagen acepta imagen base para img2img. Si no, el primer PR es
captura cruda del 3D y el estilizado IA queda para cuando haya proveedor img2img.

## Tests / validación
- Lógica pura de cámaras/ángulos testeable; captura verificada en navegador.
- Las vistas se asocian a la zona/diseño (coherente con Fase 2).
- tsc+eslint limpios; suite verde.
