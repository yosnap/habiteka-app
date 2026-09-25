---
title: "Fase 3: Diseño coherente y versión aprobada"
status: in_progress
---

# Fase 3: Diseño coherente y versión aprobada

## Objetivo

Crear una versión única del diseño de todo el inmueble, revisada desde varias cámaras y apta para visita y vídeo, basada en un catálogo ampliable de material propio y productos autorizados de la mueblería piloto.

## Trabajo

1. Mantener dos acciones explícitas: propuesta **editable** de acabados/muebles que se aplica al `EditorDocument`, y **render de imagen** que guarda una vista comercial sin modificar geometría. Explicar la diferencia en Estudio y Editor.
2. Definir versión de diseño aprobada: referencia estable al documento y activos usados, revisión/hash, autor, fecha, estado interno/publicado y lista de vistas asociadas. No depender de la revisión mutable del editor para reproducir una visita anterior. Resolver permisos por organización/proyecto.
3. Comprobar antes de aprobar: estancias cerradas, puertas transitables, plantas/exteriores, materiales, iluminación, modelos de muebles disponibles y discrepancias entre renders elegidos y escena. Separar errores bloqueantes de avisos estéticos.
4. Recomendar vistas adicionales desde ángulos que muestren rincones no revisados, accesos y estancias principales. Las vistas sirven para comparar y aprobar el acabado; no se usan como trozos de geometría.
5. Si la imagen elegida contiene muebles o acabados ausentes del 3D, proponer equivalentes editables del catálogo con revisión del usuario. Registrar lo que queda solo como imagen para no presentarlo falsamente durante la visita.
6. Conservar el storyboard existente y sus asociaciones de cámara/entregable; completar la coherencia entre vistas pendientes del plan F3 solo donde sea necesario para la aprobación global.
7. Conectar Editor v2 y la propuesta IA al catálogo persistente ya existente sin perder los muebles incorporados en código. Normalizar identidad, medidas, categoría, origen, miniatura y modelo 3D; permitir añadir progresivamente material propio. La IA recibe solo IDs elegibles y devuelve colocaciones verificables, nunca una ficha inventada.
8. Validar espacio libre, colisiones, escala y compatibilidad de cada objeto antes de aplicar una propuesta. Mostrar «modelo 3D exacto», «representación aproximada» o «solo referencia 2D» según activo disponible; solo el primero puede anunciarse como producto exacto en visita/vídeo.
9. Fijar en cada aprobación referencias inmutables a ID/SKU/variante, medidas y versión del modelo 3D. Conservar por separado datos comerciales vivos; una retirada del catálogo no borra un proyecto aprobado ni autoriza mostrar una ficha de compra obsoleta.
10. Dar a la biblioteca propia una entrada editorial: subir piezas individuales y colecciones de referencia, etiquetar estancia/estilo/material y separar «inspiración visual» de «objeto colocable». Para convertir una pieza en colocable, obtener o producir su GLB, revisar medidas, orientación, materiales y licencia; una sola fotografía no se considera reconstrucción 3D exacta.
11. Construir un chat único anclado al proyecto, la revisión y la selección activa. Enrutar órdenes explícitas por reglas y las ambiguas con una decisión tipada de Jev; etiquetar qué capacidad prepara la respuesta. Editor, decorador y acabados usan propuestas tipadas separadas, pero comparten validación, vista previa, aceptación y registro de operaciones. No crear agentes autónomos que se pasen el documento completo.
12. Reusar comandos existentes, `applyNativeDesignProposal`, `store.apply/undo` y control de revisión del guardado. Una operación generada incluye IDs y revisión esperada; el servidor revalida permisos, catálogo, medidas y conflicto de revisión antes de aceptarla. Los cambios de muros/huecos/escala exigen aceptación explícita; modificar un diseño aprobado inicia un borrador nuevo.
13. Limitar el contexto de entrada por modelo/acción: solo zona y selección pertinentes, preferencias confirmadas, catálogo elegible recortado, resumen y últimos turnos necesarios. Contar tokens de entrada y rechazar o pedir acotar antes de superar el presupuesto; mantener el límite de salida actual. Guardar coste/latencia/proveedor y evitar imágenes innecesarias. Jev actúa en checkpoints de coste/calidad y no en cada pulsación.
14. Evaluar un conjunto fijo de órdenes normales y adversariales para los tres sectores: intención ambigua, SKU inexistente, geometría inválida, catálogo con instrucciones hostiles, aprobación obsoleta y fallo de Jev/Kie. Comparar con y sin clasificación Jev; conservarla solo donde reduzca errores sin generar fricción desproporcionada.
15. Añadir al Editor v2 una vista cenital/maqueta amueblada de la misma escena editable, con cubierta ocultable, materiales PBR y presets de luz. Mantener visibles la selección y las medidas cuando se edita; tratar la fachada renderizada como vista asociada, no como fondo del plano. Las referencias visuales del usuario se describen en el plan principal.

## Código afectado

- `src/lib/editor-document/native-design-proposal.ts`, `design-context.ts`, `walkthrough-storyboard.ts`, `building-levels.ts`.
- `src/lib/editor-document/furniture-catalog.ts`, `furniture-assets.ts`, `src/components/editor-v2/catalog-panel.tsx`, `src/components/editor-v2/scene/furniture-model.tsx` y `src/components/catalog/use-catalog-items.ts`.
- `prisma/schema/catalog.prisma`, `src/app/api/catalog/route.ts` y contratos de modelos firmados; evaluar migración solo después de definir identidad/versión canónica.
- `src/components/editor-v2/editor-generate-dialog.tsx`, `storyboard-panel.tsx`, `editor-shell.tsx`.
- Repositorio versionado del documento/activos y acciones con ámbito de organización. Definir el contrato persistente antes de tocar `prisma/schema/project-canvas.prisma`.
- `src/server/agent/orchestrator.ts`, `persistence/message-repo.ts`, `src/components/chat/`, `src/lib/editor-document/commands.ts`, `src/canvas/editor-v2/store.ts`, `save-queue.ts`, `src/server/quality/` y `src/server/ai/call-limits.ts`; módulos pequeños por capacidad en vez de un archivo de chat monolítico.

## Criterios de aceptación

- Un diseño aprobado de al menos tres estancias se ve consistente desde diez cámaras sin que cambien muebles, puertas o acabados.
- Un cambio de muro, acabado o mueble aparece en el plano editable y en la maqueta sin reinterpretación IA. Al cambiar de cámara cenital a interior, persisten identidad, posición y escala de los objetos; la vista exterior se presenta por separado.
- Una vista IA sin equivalente 3D se marca como diferencia pendiente; no habilita por sí sola una visita fiel.
- Modificar el documento después no cambia una visita o vídeo ya aprobados; para actualizar se crea una nueva versión.
- La comprobación explica las vistas adicionales recomendadas y los bloqueos concretos.
- Se puede subir un elemento propio, encontrarlo en Editor v2 y pedir a la IA que lo coloque con ID estable; la colocación respeta medidas y límites del espacio.
- Una colección propia sirve para orientar propuestas de estilo sin que la IA declare colocados en 3D elementos que solo tienen imágenes de referencia.
- El proyecto aprobado conserva el mismo objeto visual aunque se edite o retire su ficha; la interfaz nunca llama «modelo exacto» a una aproximación.
- Una orden de chat muestra operación y diferencia antes de aplicarse; aceptar registra una revisión y permite deshacer. El mismo texto no altera silenciosamente un diseño aprobado ni se aplica si la revisión cambió.
- Se miden tokens de entrada/salida, llamadas, latencia y coste. Las pruebas no permiten SKU inventados, geometría inválida ni escrituras cuando fallan modelo o Jev.

## Riesgos

El render IA puede añadir elementos físicamente inexistentes. Señal: discrepancia entre dos cámaras o respecto al documento. Respuesta: convertir a entidad 3D supervisada o excluir esa imagen de la aprobación global.

## Inicio de la vista cenital

El Editor v2 ya construye muros, suelos, huecos y mobiliario desde `EditorDocument` en una única escena R3F. Se añadió el control «Maqueta» que sitúa la cámara cenital, oculta el techo y muestra una planta; no genera geometría ni una imagen paralela. Comprobado en Chrome/WebGL con una estancia y un sofá creados en `/dev/editor-v2`: el mismo mueble aparece en 2D, 3D y cenital; el control deja «Cenital» y «Techo: Oculto» activos. También se cargó, solo en la vista previa aislada de la pestaña, un documento de fixture con 10 zonas y 17 muebles: la escena muestra los mismos muros y objetos y permite cambiar la iluminación sin reconstruir el plano. El control identifica su estado activo. Una nueva comprobación visual confirmó que la maqueta cenital se renderiza sin errores de consola y con esos objetos en la misma escena, aunque hay muebles aproximados, sombras fuertes y una composición todavía básica. Faltan un inmueble patrón fiel, ajuste de materiales/luces y aprobación versionada antes de usar esta escena en visita o vídeo.

La aprobación y el pulido de esta fase quedan en espera: los dos planos de referencia aún presentan discrepancias métricas graves al conservar los muros visibles en la imagen. Primero hay que validar la importación y las correcciones de fase 2 contra el original del usuario. Una maqueta generada desde geometría dudosa no sirve como base de visita ni vídeo.
