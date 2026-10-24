# WalkMyHome como referencia de experiencia de trabajo

Fecha: 10 de octubre de 2026. Estado: referencia de producto y propuesta de evolución; **implementada localmente; navegación corregida tras revisión del usuario**. El flujo disponible sigue descrito en la [guía pública](../site/src/content/docs/guias/primer-proyecto.md).

## Dirección acordada

Aclaración final del usuario (10 de octubre, 11:52): Plano 2D también puede compartir el lateral y los menús flotantes; deben conservarse la forma de construir y las herramientas actuales. Esta aclaración prevalece sobre las restricciones iniciales de apariencia del 2D presentes en el análisis y las fases del plan. No se solicitan ventanas arrastrables.

Preferencia posterior de Escena: pestañas, capas y acordeones con pared→puertas/ventanas y techo→luminarias, nombres, visibilidad y Mostrar más. La implementación usa el documento actual, incluye suelos y elementos de construcción y mantiene Propiedades. Los nombres se editan en sus campos existentes; la ocultación individual es visual y de sesión, separada de geometría y referencias IA.

WalkMyHome es la referencia solicitada para la navegación, el trabajo sobre el inmueble, la ayuda contextual, los diseños y su presentación. **El método de construcción y las herramientas del plano 2D de Habiteka se conservan**, por indicación expresa del usuario. El asistente será **contextual junto al lienzo**, también por elección expresa. La aclaración posterior del usuario permite compartir lateral y menús con las otras vistas. No se sustituye el lienzo ni se copian herramientas o gestos de construcción externos.

La adopción busca continuidad: saber en qué proyecto, planta, estancia y versión se trabaja; encontrar la acción adecuada; volver al mismo punto después de revisar un resultado. **Escritorio, tableta y móvil entran desde el inicio**, por elección expresa del usuario. La marca, los componentes y los tokens siguen siendo los de Habiteka. La referencia externa no autoriza generaciones, aceptación de imágenes ni gasto.

**Aclaración del usuario tras elegir Comet:** solo cambian vistas, diseño y presentación de la interfaz. Todas las funcionalidades, opciones y reglas de Habiteka se mantienen. Si WalkMyHome no muestra una función propia, se adapta su acceso y representación; no se elimina, simplifica ni reemplaza su comportamiento. Las funciones exclusivas de WalkMyHome no se añaden por esta referencia. El asistente contextual presenta el asistente y acciones existentes, sin motor o flujo de pago nuevo.

## Fuentes y grado de comprobación

| ID  | Fuente                                                                                                          | Qué permite afirmar                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Escena indicada por el usuario, revisada en Comet con su sesión existente                                       | Navegación de escritorio inspeccionada: Build, Items, Materials, Visualize, Chat, Scene, Tools, Import, inspector y entrada/salida de Walkthrough. Sin operaciones de pago o edición. No se publican enlace ni contenido privados. |
| E2  | [Demo pública del constructor](https://walkmyhome.ai/builder?mobile-demo=1&v=7)                                 | Interfaz observada a 500 × 844 y 1440 × 1000; cambio de estancia desde el plano, entrada al 3D y apertura de materiales, mobiliario y tamaño probados.                                                                             |
| E3  | [Página oficial](https://walkmyhome.ai/)                                                                        | Dirección comunicada de plano → diseño → exploración, y funciones anunciadas. Las promesas comerciales no prueban fidelidad, velocidad, calidad ni comportamiento de la escena privada.                                            |
| E4  | [Ilustración oficial de plano y volumen](https://walkmyhome.ai/img/feature-proof/measurements-split-us-v4.webp) | Referencia visual de correspondencia espacial; no prueba una vista dividida interactiva.                                                                                                                                           |
| E5  | [Ilustración oficial de exploración](https://walkmyhome.ai/img/feature-proof/import-walkthrough-v4.webp)        | Referencia visual de ubicación en el inmueble y cámara interior. No acredita continuidad real del paseo.                                                                                                                           |

La revisión autenticada de escritorio complementa la demo pública. No certifica resultados, persistencia, calidad, costes ni accesibilidad externos. Un cambio de sección o un botón no acredita su operación final. El móvil autenticado no se ha probado; la observación de 500 px corresponde a la demo.

## Editor autenticado revisado en Comet

Se comprobó la pestaña de la escena solicitada y la respuesta visual tras cada navegación. Se inspeccionaron imágenes temporales de la ventana, sin copiar capturas o datos del inmueble al repositorio ni al manual.

| Región o flujo          | Observado directamente                                                                                                        | Adaptación visual en Habiteka                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navegación lateral      | Rail estrecho con Build, Items, Materials, Visualize, Chat, Scene, Tools e Import; panel contiguo según tarea                 | Agrupar accesos actuales con títulos e iconos. Conservar todas nuestras categorías y acciones, incluido Exterior. Compartir navegación en 2D; conservar su construcción. |
| Cabecera y cámara       | Proyecto, planta, 2D/3D/Split/Walkthrough; barra inferior y pistas Pan/Rotate/Zoom                                            | Jerarquizar controles actuales en Amueblado/3D. Split es un control observado, no un requisito de Habiteka. Mantener manejadores, encuadres, visibilidad y norte.        |
| Items                   | Buscador, categoría/tipo y tarjetas con miniatura y dimensiones                                                               | Presentar nuestro catálogo completo, cocina modular y exterior. Mismos activos, IDs, colocación y colisiones.                                                            |
| Materials               | Categorías, búsqueda, muestras y acceso a materiales personalizados                                                           | Conservar nuestras pinturas por cara, suelos, fachadas, clasificación y propiedades.                                                                                     |
| Visualize               | Entrada al estudio y galería. Modal Choose view → Set the look → Results, con vista actual/interior/planta, lente y recaptura | Presentar todas nuestras opciones de cámaras/ámbitos, estilo, permisos, referencias, presupuesto y resultados; no reducirlas al conjunto externo.                        |
| Preparación del estudio | Retorno al editor y aviso de preparación; siguiente paso deshabilitado durante carga                                          | Mostrar preparación y siguiente acción sin generar al abrir. No se probó la generación externa.                                                                          |
| Chat                    | Panel con alcance selección/estancia/planta/proyecto, sugerencias y entrada de texto                                          | Asistente contextual con nuestras acciones, modos, revisión de propuestas y presupuestos. No se enviaron mensajes.                                                       |
| Scene e inspector       | Árbol edificio/planta/entidades. Seleccionar una pared muestra barra cercana e inspector con dimensiones y acciones           | Orientación y selección en Amueblado/3D con nuestras Propiedades completas, protecciones, clasificación y tipos de huecos.                                               |
| Tools                   | Tarjetas de acabados, información espacial, presupuesto, luz diurna y comprobaciones                                          | Jerarquía para nuestras herramientas de parcela, sol manual, techo, luces, tejado, revisión y aprobación. No incorporar cálculos externos.                               |
| Import                  | Fuentes, destino nuevo/actual y advertencia de sustitución de importación                                                     | Presentar el importador actual, formatos, original, revisión y protección geométrica. No replicar reemplazos de datos.                                                   |
| Walkthrough             | Entrada a vista interior que ocupa la pantalla, guía de controles y salida; salir devuelve al editor                          | Referencia para despejar interfaz y facilitar retorno. No importar atajos ni habilitar visita final de maqueta. Conservar límites actuales.                              |

Se confirmó visualmente cambio de panel, apertura/cierre del estudio, selección con inspector y entrada/salida de Walkthrough. No se probaron desplazamiento completo, colisiones, edición, guardado, exportación, generación ni móvil en la escena autenticada. Se revisa UX visible, no fiabilidad funcional externa.

## Observaciones de la demo

| Patrón                         | Evidencia                              | Lectura UX y adopción propuesta                                                                                                                                                               |
| ------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Espacio protagonista           | E2, captura visual de escritorio       | Lienzo amplio; columna lateral estable y barra compacta sobre la escena. En Habiteka se aplica a Amueblado/Modelo 3D y a los espacios de resultados, respetando Plano 2D.                     |
| Estancia como contexto         | E2, clic en Home Office desde el plano | Se actualizan el título, la estancia activa y la escena 3D. Proponer selección y localización de estancia en Amueblado/3D; el 2D de Habiteka mantiene sus interacciones actuales.             |
| Herramientas agrupadas         | E2, secciones desplegables             | Estancias, materiales, mobiliario y huecos aparecen juntos y con títulos cotidianos. Proponer inspector contextual y categorías reconocibles usando los paneles existentes.                   |
| Acción directa                 | E2, catálogo visible                   | La demo ofrece piezas y explica cómo colocarlas; no se completó una prueba de colocación. Reutilizar la colocación de Habiteka, sus colisiones y deshacer; mejorar descubrimiento y contexto. |
| Controles de cámara próximos   | E2, barra visual                       | Zoom, tamaño, luz, restablecer y guardar se separan del contenido del panel. Proponer jerarquía consistente para cámara, edición y generación.                                                |
| Acciones de resultado visibles | E2                                     | Walkthrough y Render destacan al pie. No se ejecutaron. En Habiteka las acciones deben expresar qué preparan, qué requisitos faltan y cuándo consumirán créditos.                             |
| Adaptación a pantalla estrecha | E2, vista de 500 px                    | Plano/escena y panel se apilan; las acciones permanecen al pie. Habiteka debe validar los nuevos flujos en móvil desde el primer incremento.                                                  |

### Qué funciona y qué hay que revisar

La selección de estancia concentra el trabajo y el lienzo responde sin buscar otra página. La agrupación por necesidades reduce el esfuerzo de localizar herramientas. La barra de cámara deja el contenido lateral para editar.

En la demo, el árbol accesible expone botones de color sin nombre. Algunas acciones primarias abren el camino hacia el producto completo, y la franja comercial ocupa espacio de trabajo. Habiteka debe usar controles con nombre accesible, acciones concretas y estados explícitos. No se han medido contraste, tamaños táctiles de todos los controles, navegación completa por teclado ni rendimiento de WalkMyHome: esas dimensiones siguen pendientes de auditoría.

## Brechas de Habiteka, contrastadas con código

Estos hallazgos describen estructura de código. En Comet se observó también la composición general de un editor de Habiteka ya abierto, sin editarlo; esa observación no sustituye la línea base de regresión ni una prueba completa de sus interacciones.

| Área               | Base existente                                                                                             | Brecha que debe resolver el plan                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proyecto           | `src/components/app/project-tabs.tsx` conserva zona entre varias rutas                                     | Hay seis destinos: Asistente, Plano, Editor, Diseños, Vídeos, Historial. Conservar contexto completo y retorno, sin retirar rutas ni enlaces existentes.                                       |
| Importación        | `src/components/plano-studio/studio-stage-nav.tsx`                                                         | El progreso distingue original, plano, imágenes y vídeo guardados; tener un archivo no equivale a tener un diseño aceptado o un resultado revisado.                                            |
| Espacio de trabajo | `src/components/editor-v2/editor-shell.tsx`                                                                | Ya existe una ranura lateral exclusiva y componentes reutilizables. El asistente conversacional vive en otra ruta; Contexto IA no es ese asistente.                                            |
| Vistas             | `src/components/editor-v2/editor-view-switch.tsx`, `src/canvas/editor-v2/view-mode.ts`                     | Plano 2D, Amueblado y Modelo 3D ya existen. Los cambios respetan operaciones pendientes. Preservar ese contrato; evitar un segundo editor o una vista dividida obligatoria.                    |
| Cámara             | `src/components/editor-v2/scene/scene-view-controls.tsx`                                                   | Hay encuadres, entrada a estancias y visibilidad de techo/muros. Mejorar descubrimiento y retorno de cámara en 3D, sin rediseñar controles del plano 2D.                                       |
| Exploración        | `src/components/editor-v2/scene/free-walk-overlay.tsx`                                                     | Hay infraestructura de paseo, mapa y guía. En la llamada actual a SceneViewControls, `canFreeWalk={false}`: no anunciar ese botón como disponible ni activarlo para presentar el diseño final. |
| Diseños            | `src/components/deliverables/render-image-dialog.tsx`, `render-acceptance.tsx`, `render-batch-gallery.tsx` | Ya hay visor, tandas, petición de cambios y aceptación. Conectar los estados a la próxima acción y al contexto que originó el resultado.                                                       |
| Vídeos             | `src/components/editor-v2/video-studio-workspace.tsx`, `video-studio.tsx`                                  | Ya existe un estudio independiente. Conservar revisión, compatibilidad, presupuesto y recuperación; no recrear sus operaciones desde el asistente.                                             |
| Preferencias       | `src/components/editor-v2/editor-preferences.ts`                                                           | Guarda visibilidad, atajos y original; no representa por sí sola el contexto completo de navegación. Diseñar persistencia por proyecto/zona y usuario.                                         |

## Interfaz objetivo propuesta

Estado: diseño pendiente de validación visual. Los nombres siguientes son propuestas, no botones disponibles.

Composición de referencia: rail por tareas, panel activo, escena amplia e inspector al seleccionar. Habiteka reutiliza el estado y exclusividad de paneles existentes; puede adaptar su ubicación según tarea en Amueblado/3D. No se crean dos dueños de selección; se reorganiza la navegación del 2D por autorización expresa.

| Región                | Contenido y comportamiento                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cabecera de proyecto  | Nombre, zona/planta activa, sincronización y acceso a historial; el usuario identifica el contexto sin abrir un menú.                                                                              |
| Navegación de trabajo | Preparar, Diseñar y Presentar como agrupación orientativa sobre las rutas existentes. El acceso al plano 2D está en la barra flotante de vistas; mantiene su funcionamiento.                       |
| Lienzo Amueblado/3D   | Espacio dominante, con contexto de estancia y cámara, selección visible y controles compactos de navegación.                                                                                       |
| Panel contextual      | Propiedades/catálogo/materiales/ayuda de IA según tarea; mantiene la exclusividad de paneles existente. Abrir la ayuda no debe borrar selección ni reiniciar cámara.                               |
| Asistente             | Peticiones asociadas al proyecto, planta, zona, selección y versión; devuelve una propuesta revisable y la acción pertinente. No aplica geometría ni inicia IA de pago por conversación implícita. |
| Resultados            | Tandas y versiones con estados comprensibles: pendiente, aceptado, descartado o referencia; detalle y acción siguiente junto a la imagen.                                                          |
| Presentación          | Modalidad, referencias aceptadas compatibles, cobertura, presupuesto y resultado revisado. Una visita aún no implementada mantiene bloqueo explicado.                                              |

Esquema orientativo **solo para Amueblado/3D y resultados**:

```text
Proyecto · planta · zona · sincronización                 Historial
Navegación del proyecto                         Acción de la tarea
┌─────────────────────────────────┬──────────────────────────────┐
│                                 │ Contexto de estancia/objeto  │
│       Inmueble / resultado       │ Propiedades o catálogo       │
│                                 │ Asistente contextual         │
│  Cámara · encuadre · visibilidad │ Propuesta y acción siguiente │
└─────────────────────────────────┴──────────────────────────────┘
Estado concreto · requisito pendiente · preparación sin gasto
```

La ranura lateral cambia de contenido, no muestra necesariamente todos estos bloques simultáneamente. Si vuelve a Plano 2D, encuentra los mismos comandos de construcción en la navegación compartida.

### Escritorio, tableta y móvil

En escritorio, panel contextual plegable y escena visible. En tableta y móvil, panel de tarea como hoja con altura regulable o pantalla de detalle según espacio, con retorno claro al inmueble. Con el teclado virtual abierto, petición y acción deben seguir visibles. No trasladar toda la barra de escritorio a una fila de iconos sin nombre.

Probar inicialmente 360, 390, 768, 1024 y 1440 px, orientación vertical/horizontal, zoom de texto y áreas seguras. Objetivo propuesto de controles táctiles: 44 × 44 px. Cámara con gestos propios de 3D, y alternativas con botones; no exigir pointer lock ni teclado físico. Los gestos y la adaptación actual del plano 2D se conservan; sus limitaciones se registran sin introducir un rediseño dentro de este plan.

## Flujos objetivo

### 1. Preparar el inmueble

Crear/abrir proyecto → importar o dibujar → revisar medidas → abrir el editor actual. Mantener las rutas de entrada y distinguir rediseño desde una foto sin plano. La ayuda contextual explica avisos y propone la siguiente acción, sin rediseñar la edición 2D ni certificar las medidas por IA.

### 2. Trabajar en Amueblado y Modelo 3D

Seleccionar estancia/objeto → ver propiedades o catálogo → ajustar → comprobar volumen y circulación → deshacer si procede. Cambiar de vista o abrir ayuda conserva contexto. Un trazo o colocación pendiente respeta los bloqueos actuales. La cámara no convierte una captura de la guía en un diseño aceptado.

### 3. Pedir ayuda o una propuesta

Abrir asistente contextual → describir intención sobre el alcance visible → recibir resumen de lo que cambiaría → revisar coste y permisos → preparar propuesta → revisar/aplicar. Reutilizar los servicios de diseño del plano y separar esa propuesta de la generación de imágenes. La nueva interfaz cambia la navegación del 2D, pero conserva sus gestos y comandos.

### 4. Generar y revisar diseños

Plano guía sincronizado y aprobado → preparar ámbito, cámaras, luz y referencias → revisar presupuesto → generar con autorización → consultar tanda → comparar → aceptar explícitamente cada diseño. Pedir cambios crea otra versión pendiente. Volver al editor recupera zona, planta y vista. Un cambio del plano señala incompatibilidad de los resultados anteriores.

### 5. Preparar vídeo o exploración final

Diseño aceptado → elegir modalidad → comprobar referencias compatibles y cobertura → preparar sin gasto → confirmar generación y presupuesto → revisar tomas y uniones → exportar cuando corresponda. El montaje de imágenes, los pilotos de construcción y primera persona, y una visita continua tienen capacidades distintas. **La visita virtual continua sobre diseños aceptados sigue pendiente**; no se habilita usando el paseo del modelo guía.

### 6. Retomar un proyecto

Abrir proyecto → recuperar contexto permitido → mostrar tarea y estado real → continuar sin repetir operaciones cobradas. Historial de ediciones, versiones del diseño, tareas IA y resultados permanecen distinguibles. Un conflicto de guardado conserva ambas versiones y exige la resolución existente.

## Contratos que gobiernan la adopción

- Plano 2D: conservar herramientas, gestos, atajos, selección, cotas, imanes, dibujo, original, deshacer y rendimiento. Lateral y menús se rediseñan por aclaración expresa.
- Contexto: proyecto, zona, planta, estancia/selección, vista, cámara y revisión; validar pertenencia y existencia antes de restaurar. No guardar referencias caducadas ni datos privados en enlaces públicos.
- IA: reutilizar acciones y autoridad del servidor; presupuestos y permisos visibles. La conversación no equivale a consentimiento de gasto.
- Aprobación: distinguir geometría aprobada, auditoría automática, aceptación humana de la imagen y revisión del vídeo. Ningún estado se deduce solo por existencia de archivos.
- Finales: muebles/acabados de diseños IA aceptados; arquitectura íntegra; hiperrealismo y continuidad comprobados visualmente. Bloquear si faltan referencias o implementación.
- Ayudas: no duplicar la tabla de atajos; usar `src/canvas/editor-v2/editor-shortcuts.ts` y sus manejadores.
- Documentación: actualizar Starlight y novedades cuando se implemente cada cambio visible; no presentar este documento como manual de funciones disponibles.

## Equivalencia funcional obligatoria

Antes de implementar, inventariar **todas** las entradas y opciones reales, también las que no tienen equivalente en WalkMyHome. Por función registrar ubicación actual, presentación propuesta, manejador/servicio existente, estados y regresión. Estas familias son el mínimo, no una lista que permita omitir otras capacidades reales:

| Familia propia          | Funcionalidad que se conserva                                                                                              | Adaptación visual permitida                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Proyecto y versiones    | Rutas, zonas, plantas, permisos, guardado, conflictos, historial y .habiteka                                               | Jerarquía de cabecera, grupos y retorno                                |
| Plano 2D                | Apariencia, controles, dibujo, cotas, atajos, original, imanes, selección, deshacer y rendimiento                          | Navegación compartida; construcción sin cambios                        |
| Construcción y exterior | Todos los tipos/opciones de muros, huecos, puertas, ventanas, columnas, escaleras, rampas, terrenos y elementos exteriores | Categorías y acceso en Amueblado/3D                                    |
| Catálogo y cocina       | Todas las piezas, dimensiones, acabados, cocina modular, soportes, colocación y colisiones                                 | Filtros y tarjetas; mismos IDs y operaciones                           |
| Acabados y envolvente   | Caras interior/exterior, clasificación, suelos, techo, luces, tejado y piezas                                              | Paneles con todos los campos actuales                                  |
| Parcela y luz           | Ortofoto, encaje, norte, ambientes y sol manual                                                                            | Accesos contextuales; mismos valores y límites                         |
| Asistente y propuestas  | Intención, alcance, modos, decoración, propuestas, revisión y aplicación                                                   | Panel junto al lienzo; mismos servicios                                |
| Imágenes                | Cámaras/ámbitos, referencias, coste, auditorías, tandas, retoques, variantes, aceptación y retirada                        | Estudio/galería/visor con estados claros                               |
| Vídeos y recorridos     | Modalidades, preparación de rutas, cobertura, presupuesto, reintentos, revisión y exportación disponibles                  | Presentación coherente; misma elegibilidad                             |
| Sin equivalente externo | Toda capacidad real recogida en el inventario                                                                              | Ubicación propia coherente; nunca desaparecer por faltar en WalkMyHome |

La aceptación del rediseño exige inventario completo antes/después: ninguna función, opción o campo perdido ni cambio de motor, servicio o esquema de negocio por imitación visual. Las capacidades hoy pendientes conservan sus bloqueos; este plan no las implementa ni cambia su estado.

## Herramientas avanzadas y alcance

El editor autenticado muestra accesos a estudio solar, información espacial, presupuesto y comprobaciones. Se observaron entradas, no cálculos o resultados. Su valor aquí es la jerarquía visual. Habiteka presenta sus herramientas existentes de sol manual, parcela, cubierta, luces y revisión; las capacidades exclusivas externas quedan fuera del alcance funcional del rediseño.

No anunciar simulación solar astronómica, validación normativa, precios reales, auditoría de presupuestos ni exportación GLB/STL/OBJ sin implementación y verificación propias. El objetivo UX no decide proveedores, precios o modelo comercial. Los bocetos de integración deben conservar las medidas y edición actual del 2D.

## Criterios de aceptación

1. Un usuario identifica proyecto/planta/zona y acción siguiente sin buscar otra pantalla.
2. En Amueblado/3D llega a catálogo, propiedades y asistente en un máximo propuesto de dos acciones desde la selección; validar con prototipo.
3. Volver de Diseños/Vídeos recupera contexto válido y no pierde cambios, una operación pendiente ni una tarea ya iniciada.
4. El plano 2D mantiene sus pruebas de interacción y construcción; se revisa la nueva navegación.
5. Ningún botón ejecuta una llamada de pago al navegar o abrir paneles; coste, confirmación y reintento permanecen explícitos.
6. Falta de aceptación, incompatibilidad o modalidad pendiente explican el bloqueo y la acción para resolverlo; no ofrecen el 3D guía como resultado final.
7. Navegación con teclado y foco visible; panel/modal devuelve el foco. Paneles flotantes solicitados por el usuario, con cierre accesible para recuperar la escena también en móvil.
8. El prototipo y la implementación se prueban con inmueble interior/exterior, varias plantas, borrador divergente y fallo/recuperación de IA.
9. El inventario completo de funciones/opciones de Habiteka conserva correspondencia antes/después, también sin equivalente en WalkMyHome.

## Ejecución y cuestiones abiertas

La ampliación de Opciones incorpora búsqueda Ctrl/Cmd+K en Amueblado/3D, disposición apilada/separada/aislada de plantas, visibilidad, nueve ambientes cromáticos, cuadrícula, etiquetas y medidas generales en metros o pies. Son preferencias temporales de visualización, sin cambios al documento. La separación añade 4 m por nivel solo en la escena; capturas y recorridos restauran posiciones reales y desactivan las ayudas. Explorar el plano guía admite clic sobre suelo visible de la planta actual, reutiliza `findWalkablePath` y `moveBuildingWalk` y conserva colisiones; el cambio entre plantas sigue requiriendo marcha por escaleras transitables. No crea visitas finales ni sustituye diseños aceptados. Guía pública: [Opciones de escena](../site/src/content/docs/editor/opciones-escena.md).

Implementación autorizada el 10 de octubre: barra izquierda con siete grupos desplegables, Ayuda y Ajustes al pie y menús flotantes en los tres modos. Se reutilizan el catálogo, inspector, preparación, copia `.habiteka`, recuperación de borradores y asistente existente. El audio del espacio de trabajo queda como mejora futura. El plano 2D comparte la composición tras la aclaración del usuario; conserva su construcción.

Módulos implementados en `src/components/editor-v2/workspace/`; conversación compartida en `src/components/chat/project-assistant.tsx`. La vista se recuerda por usuario/proyecto/zona; selección filtrada por elementos existentes y planta activa; cámara exterior por presentación/planta. No se guardan documentos geométricos ni cámaras de producción en este estado de interfaz. Diseños y Vídeos reutilizan sus componentes y guardas actuales con una composición más amplia.

Los diálogos compartidos, como Tejado, mantienen un único montaje aunque el panel de Herramientas esté cerrado: Construir y los controles del plano conservan sus entradas de configuración. El contenido visible no se duplica en la cabecera y el lateral.

El [plan de adopción](../../plans/261010-0427-referencia-walkmyhome/plan.md) separa contrato visual e inventario, interfaz, trabajo contextual, resultados, adaptación de herramientas propias y validación. El [informe de evidencia](../../plans/reports/ux-261010-0427-walkmyhome-report.md) registra demo y revisión autenticada en Comet.

Revisión autenticada de navegación de escritorio realizada en Comet. La distribución se valida sobre la implementación en muestras aisladas y navegación local sin generar ni editar proyectos privados. La revisión móvil externa sigue limitada a la demo; la adaptación móvil de Habiteka se comprueba directamente en su interfaz. Decisiones confirmadas: vistas/diseño con equivalencia funcional completa, construcción 2D conservada y navegación compartida, asistente contextual y móvil desde el inicio.
