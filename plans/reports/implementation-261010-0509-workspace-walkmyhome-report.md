# Implementación del espacio de trabajo con referencia WalkMyHome

Fecha: 2026-10-10. Rama: `feat/publicidad-vertical-cotas`. Entrega local; no commit, push ni despliegue.

## Resultado

Amueblado/Modelo 3D incorporan barra izquierda con vistas y tareas, Ayuda y Ajustes inferiores y paneles flotantes. El plano 2D conserva su CSS, Toolbar, CanvasView y tabla de atajos. La conversación existente se comparte entre su página y el lateral; se monta al abrir el asistente y permanece al plegarlo. Contexto visible de planta/selección; no se envía automáticamente a IA.

Galería de diseños más amplia con retorno al editor y acceso a Vídeos. El estudio de vídeo separa tareas a la izquierda y configuración/revisión en el área principal; se apila en móvil. Diálogos de diseño y visor mantienen foco, confirmaciones y opciones existentes con más espacio para las vistas.

## Correspondencia funcional

| Entrada anterior                      | Presentación actual                | Contrato conservado                                                                                                                                         |
| ------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plano 2D                              | Interfaz original                  | CanvasView, Toolbar, selección, gestos, cotas y atajos                                                                                                      |
| Amueblado/Modelo 3D                   | Vistas al principio del lateral    | EditorViewSwitch, prepareViewChange, bloqueos de operaciones pendientes                                                                                     |
| Seleccionar, Medir, Ajuste            | Lateral espacial; originales en 2D | Mismos manejadores del store y viewForTool                                                                                                                  |
| Construir                             | Panel flotante                     | ConstructionMenu completo: paredes, formas, habitaciones, aberturas, columnas, escaleras, rampas, tejado, cocina, exterior, patios e importación disponible |
| Amueblar                              | Catálogo flotante                  | CatalogPanel, filtros, modelos y colocación existentes                                                                                                      |
| Propiedades                           | Lateral y accesos en Escena        | Inspector completo, edición individual/en bloque y todos sus campos                                                                                         |
| Apariencia y suelos                   | Acabados → selección/Propiedades   | Inspector, detalle de apariencia y FloorFinishPanel originales                                                                                              |
| Techo, luces y tejado                 | Acabados/Herramientas              | CeilingLightingPanel, ExteriorRoofPanel y useRoofWorkflow                                                                                                   |
| Recorrido/storyboard                  | Lateral/Herramientas               | WalkthroughPanel, StoryboardPanel, cámaras y generación de puntos originales                                                                                |
| Contexto IA                           | Herramientas                       | FurnitureContextPanel sin cambios                                                                                                                           |
| Visibilidad y atajos                  | Herramientas/Ajustes               | VisibilityMenu y preferencias existentes                                                                                                                    |
| Orientación, sol y parcela            | Herramientas                       | PropertyOrientationPanel y GeographicSitePanel, sin nuevos cálculos                                                                                         |
| Guardado, deshacer, rehacer y plantas | Cabecera existente                 | Cola durable, autoridad, BuildingLevelMenu y comandos originales                                                                                            |
| Aprobación y versión aprobada         | Herramientas                       | Mismos callbacks y restricciones de sesión/revisión                                                                                                         |
| Backup y exportación                  | Ajustes/Herramientas               | API .habiteka, ImportProjectButton, exportación de plano y recuperación local existentes                                                                    |
| Asistente                             | Página original y panel contextual | QualificationChat, PlanReviewPanel, estado por proyecto/zona y advanceAgent                                                                                 |
| Diseñar con IA/Visualizar             | Cabecera/lateral/asistente         | EditorGenerateDialog, presupuestos, calidad y revisión actuales                                                                                             |
| Diseños y visor                       | Galería amplia y diálogo flotante  | Tandas, variantes, aceptación/retirada, referencias y cambios originales                                                                                    |
| Vídeos                                | Tareas laterales y área principal  | Construction, PropertyVisit y VideoStudioMedia; recuperación y confirmación de gasto intactas                                                               |
| Historial, plano e importación        | Rutas originales                   | ProjectTabs y rutas conservados                                                                                                                             |

## Contexto de retorno

Preferencias locales de la pestaña, separadas del documento y del guardado. Clave por usuario/proyecto/zona; nunca compartida con muestras sin propietario. Selección validada contra el índice real y planta activa. Visibilidad de techo recordada; cámaras exteriores por presentación/planta/estado de plantas apiladas. Una referencia ausente o corrupta vuelve a la vista inicial; la cámara interior se vuelve a elegir con los controles existentes.

Las capturas temporales, exportaciones y recorridos no reemplazan la cámara de trabajo. No se duplican stores, sesiones de edición, colas ni backends de IA. El cierre de paneles devuelve el foco al control de apertura; el asistente se oculta sin reiniciar su paso local.

## Verificación

- 94 pruebas correctas en 16 archivos: navegación, paneles, selección, índice de elementos, guardado, recuperación, conflictos, atajos, orientación, iluminación, aprobación, referencias y vídeo. Incluyen cinco pruebas nuevas de separación de ámbito, almacenamiento bloqueado/cuota y rechazo de cámaras inválidas. Una cuota agotada conserva también el último cambio local cuando existe una vista anterior en almacenamiento.
- TypeScript y ESLint correctos. Compilación de Next correcta.
- Documentación de usuario actualizada en herramientas, primer proyecto, imágenes, vídeos y novedades. Documentación técnica y plan actualizados.
- Referencia y proyecto local revisados en Comet: lateral, asistente, galería, Vídeos y retorno a la misma cámara exterior, sin editar geometría, aceptar imágenes ni generar material.
- Muestra no privada: 360/390, 768/1024 y 1440 px mediante emulación de viewport. Paneles dentro de la ventana, sin desbordamiento horizontal. Comprobación de apertura/cierre, búsqueda, tareas, X, Escape y devolución de foco. El CSS heredado desplazaba la escena al abrir paneles; se corrigieron especificidad y colocación de grid.
- CSS, Toolbar, CanvasView y tabla de atajos del 2D sin diferencias. Shell menor de 1000 líneas; integración dividida en módulos pequeños.
- Contraste calculado de texto del lateral: 10,27:1 normal y 9,80:1 seleccionado. Controles de al menos 44 px y foco visible; movimiento reducido respetado.
- El servidor de desarrollo anterior dejó de responder; se reinició localmente y volvió a responder. No se modifica infraestructura de producción.
- Un cambio rápido de emulación mostró el aviso existente de WebGL. Al repetir a 768 px con carga estable apareció el lienzo 3D sin errores; se conserva el fallback original. La búsqueda «Cocina» devolvió la estancia y el mueble correspondientes, y Construir quedó dentro del área espacial a 390 px.
- Comprobaciones finales: `npm run docs:updates`, `npm run docs:build` (18 páginas, cero errores/avisos), `ak plan validate` y `git diff --check` correctos. 23 enlaces locales de los nueve documentos finales comprobados sin errores.
- Revisión del ciclo de vida: los diálogos compartidos siguen montados fuera de Herramientas, con un solo dueño visible/oculto. Se comprobó Construir → Tejado → Tejado exterior y la entrada de Herramientas: un único diálogo en cada caso, sin editar ni añadir cubierta. Esto evita perder la entrada externa al mover el menú de la cabecera.

## Límites

Actualización posterior: el usuario detectó que los paneles fijos de altura completa no reflejaban los menús flotantes ni la jerarquía de la referencia. Aclaró además que el lateral del 2D puede rediseñarse, conservando la construcción. El primer inventario y las comprobaciones anteriores describen la entrega inicial; la corrección se documenta en el [informe de navegación y menús](implementation-261010-1152-menus-flotantes-report.md).

Adaptación responsive verificada en navegador; no sustituye pruebas en hardware móvil real. No se ejecutan generaciones de pago ni una nueva producción de vídeo para comprobar un cambio visual. Guardas y servicios existentes conservados; no se anuncian nuevos motores, exportaciones o modalidades finales. Audio del espacio de trabajo: futuro. Las visitas finales pendientes siguen requiriendo diseños IA aceptados y su implementación propia.

Las capturas privadas se inspeccionaron temporalmente; no se copian al repositorio ni a la guía pública. El archivo ajeno `scripts/tmp-promo-fotos.ts` permanece intacto.
