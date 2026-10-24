---
title: 'Fase 3: Navegación 3D y edición contextual'
status: completed
---

# Fase 3: Navegación 3D y edición contextual

## Objetivo y dependencias

P1. Completada localmente. Hacer que selección, escena y ayuda compartan contexto, con móvil desde el inicio. Plano 2D permanece íntegro.

## Requisitos y arquitectura

Amueblado/3D: estancia y objeto reconocibles, propiedades/catálogo próximos, cámara con retorno y ayuda contextual. Mantener la ranura única existente. El asistente reutiliza transporte y acciones del chat; Contexto IA actual no se renombra como si fuese conversación.

Separar controles de cámara, edición y resultado. No cambiar colisiones, identidad del catálogo ni geometría para imitar la demo. No activar paseo nativo como visita del diseño final.

El asistente junto al lienzo presenta la conversación y acciones actuales. El rail, tarjetas, muestras e inspector se adaptan visualmente sin quitar modos, campos, tipos o categorías de Habiteka. No crear operaciones nuevas por similitud con WalkMyHome.

## Pasos

1. Integrar localización de estancia en Amueblado/3D y sincronizar selección válida con panel; no modificar selección, plano ni gestos del 2D.
2. Agrupar cámara/encuadre/visibilidad y entrada/salida de estancia sin perder posición anterior. Revisar nombres cotidianos y ayudas breves.
3. Reusar catálogo, propiedades, materiales, cubierta y luces. La colocación conserva validación y deshacer existentes.
4. Añadir panel de asistente contextual con proyecto, zona, planta, selección y revisión. Definir qué resumen y referencias recibe; no enviar capturas ni contexto innecesarios.
5. Resolver conversación → preparación/revisión mediante acciones existentes. El asistente propone; aplicar cambios y generar siguen sus controles explícitos, permisos y presupuesto.
6. Presentar los controles táctiles y de cámara existentes de forma accesible; hoja para panel/asistente en móvil, sin alterar sus manejadores ni exigir teclado físico o pointer lock.
7. Gestionar respuesta obsoleta: si cambia contexto/revisión, impedir aplicar sobre otro objeto y pedir actualizar preparación.

## Archivos

Modificar según prototipo: `src/components/editor-v2/editor-side-panel.tsx`, `catalog-panel.tsx`, `inspector.tsx`, `scene/scene-view-controls.tsx`, `scene/editor-scene-view.tsx`; integración acotada de `editor-shell.tsx`.

Reutilizar `src/components/chat/qualification-chat.tsx`, `use-agent-stream.ts`, `agent-stream-store.ts`, `src/server/editor/authority.ts`. Propuesta nueva: `src/components/editor-v2/contextual-assistant-panel.tsx`, sin recrear backend. Cualquier cambio a `store.ts` solo para estado de panel y con regresión.

Actualizar Starlight: `editor/herramientas.md`, `ayuda/novedades.md`; `editor/atajos.md` solo si cambia un atajo fuera del 2D, contrastándolo con la tabla única y su manejador.

## Seguimiento

- [x] Conectar estancia/selección, panel y retorno de cámara.
- [x] Integrar ayuda contextual con servicios existentes.
- [x] Validar coste/permisos y rechazo de contexto obsoleto.
- [x] Probar gestos 3D y paneles en móvil/tableta/escritorio.
- [x] Actualizar manual y novedades reales.

## Aceptación y pruebas

Desde selección de Amueblado/3D, catálogo/propiedades/asistente alcanzables en dos acciones como máximo propuesto. Abrir/cerrar ayuda no borra selección ni cámara. Preparación sin consentimiento nunca llama a imagen/vídeo de pago. Resultado de otra revisión no se aplica silenciosamente. 2D conserva todos sus contratos.

Ejecutar pruebas existentes de `tests/editor-v2/side-panel.test.ts`, `view-navigation.test.ts`, `editor-shortcuts.test.ts`. Nueva cobertura solo para contratos reales de contexto/permisos. Prueba manual táctil y teclado, fallo de IA, cambio de zona y vuelta desde un diálogo.

## Riesgos y siguiente paso

La exclusividad actual de paneles y la conversación tienen ciclos de vida distintos; conservar mensajes al plegar sin mantener suscripciones duplicadas. Continuar con revisión de diseños y medios, no con exportación de maqueta.

## Resultado de implementación

Completado dentro del alcance visual autorizado. [Inventario y verificación](../reports/implementation-261010-0509-workspace-walkmyhome-report.md). Se conserva el 2D y los servicios existentes. Barra izquierda, Ayuda/Ajustes inferiores y paneles flotantes; audio futuro. Responsive verificado por emulación y navegación local en Comet, sin generar ni aceptar material. Cámara exterior restaurada; la interior se elige con los controles actuales. Las pruebas no sustituyen hardware móvil real ni validación de una producción IA. Entrega local; no despliegue.
