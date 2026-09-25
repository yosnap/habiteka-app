# HANDOFF: editor visual, importación y futura inmersión
Generated: 2026-09-25 00:27 Europe/Madrid · Session focus: retomar Habiteka en una sesión nueva sin perder el flujo plano → diseño → visita → vídeo.

## Goal
Un editor con plano cenital amueblado y atractivo, pero realmente editable; después, una visita libre en primera persona y vídeo publicitario desde el mismo inmueble y versión aprobada. Sirve a inmobiliarias, interioristas y tiendas, con piloto de mueblería aún sin socio.

## Why This Matters
El usuario aportó siete referencias visuales. Las imágenes 1 y 2 son prácticamente la misma composición (fachada y plano cenital); las 3–7 son maquetas de inmuebles distintos. Son objetivos de acabado y cámaras, no geometría que pueda fusionarse ni prueba de navegación interior.

## Current State
El plan integral está en `plans/260924-1459-flujo-integral-plano-diseno-inmersion-video/`; fase 2 sigue en curso, fases 3–5 pendientes. La dirección visual quedó escrita en `plan.md` y en las fases 3–5. La importación PDF rasteriza la primera página; el boceto recién dibujado guarda extracción revisable, abre la misma tabla de medidas que imagen/PDF y conserva la revisión tras recarga. Estudio y asistente piden confirmación antes de reemplazar el plano del editor. El editor fotorrealista, la visita libre y el vídeo de montaje **no están implementados**. Los cambios del trabajo actual siguen sin commit ni push; preservar el árbol de trabajo.

## Key Decisions and Why
El documento editable y sus activos 3D versionados serán la fuente común. Imagen IA = referencia/presentación, no geometría transitable. Editor: precisión 2D más maqueta cenital amueblada conectada; exterior como vista asociada, no fondo fijo del lienzo. Visita: cámara a altura de ojos sobre la misma escena. Vídeo: exterior → cenital/maqueta → interior de la versión aprobada. Three/R3F sigue como base hasta medir límites de calidad/rendimiento. El boceto no inventa cotas ni llama a visión IA al crearse; muestra escala pendiente de confirmar.

## Rejected Approaches and Traps
No reconstruir una casa pegando vistas generativas ni declarar exacto un SKU con solo fotografía. No confundir imagen isométrica con paseo interactivo. No ejecutar pruebas de BD contra desarrollo: usar solo la base aislada marcada. No gastar créditos Kie ni modificar la finca del usuario para validar el flujo. Un antiguo boceto sin extracción guardada aún conserva el envío legacy: no extrapolar que todos los históricos se unificaron.

## Verification Status
`bun run build`, `bun run typecheck`, ESLint de los archivos tocados y `git diff --check` pasaron. Once archivos de pruebas pertinentes: 34/34 en PostgreSQL aislado; incluye PDF real, boceto, importación y autoridad del editor. La prueba funcional visual PDF selección → tabla → editor **no está cerrada**: el intento con Chrome quedó inconcluso por bloqueo de carga de archivos/extensión y falta de hidratación de la página temporal (ya retirada). En dos fixtures reales de fidelidad, solo 9/12 y 5/10 estancias quedaron dentro de ±5 %; la revisión humana continúa siendo necesaria.

## Relevant Files and Pointers
`docs/prd-inmueble-verificable-inmersion-video-catalogo.md`; `plans/260924-1459-flujo-integral-plano-diseno-inmersion-video/plan.md` y `phase-02-importacion-y-edicion.md` a `phase-05-video-construccion-y-recorrido.md`. Implementación: `src/components/plano-studio/plano-studio.tsx`, `plan-import-panel.tsx`, `pdf-to-png.ts`, `src/server/plan/drawing-to-plano.ts`, `src/app/(app)/projects/[id]/_actions/studio-actions.ts`, `src/components/editor-v2/scene/editor-scene-view.tsx`. Pruebas nuevas: `tests/lib/pdf-first-page.test.ts`, `tests/ai/drawing-to-plano.test.ts`, `tests/server/studio-results-actions.test.ts`.

## Open Work and Dependencies
Pendiente validar visualmente imagen/PDF/boceto hasta Editor v2, resolver discrepancias de medidas/huecos/exteriores, y cerrar el revisor de plano en chat. Después, implementar la maqueta cenital amueblada del editor con cámaras y activos fieles; la aprobación versionada antecede visita y vídeo. El inmueble patrón y las fotos/cámaras de referencia aún no están fijados; tampoco hay acuerdo con una mueblería. La calidad visual final debe evaluarse en tiempo real y en exportación, sin prometer fotorrealismo idéntico a una imagen IA en móvil.

Prompt para la nueva sesión: «Continúa Habiteka desde este handoff. Lee el PRD y el plan integral, verifica el estado real del repositorio y las pruebas antes de actuar. Prioriza cerrar la fase 2 sin tocar datos reales; luego aborda la vista cenital amueblada del Editor v2 usando una sola escena coherente para futura visita y vídeo. Háblame siempre en español.»
