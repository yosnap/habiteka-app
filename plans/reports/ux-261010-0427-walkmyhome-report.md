# Evidencia UX: WalkMyHome y adopción en Habiteka

Fecha: 10/10/2026. Alcance: documentación y planificación. No se ha modificado la aplicación ni iniciado gasto de IA.

## Resultado

Referencia duradera en [docs/ux/walkmyhome-reference.md](../../docs/ux/walkmyhome-reference.md) y [plan de seis fases](../261010-0427-referencia-walkmyhome/plan.md). Decisiones expresas: solo vistas/diseño, todas las funcionalidades/opciones propias conservadas y adaptadas aunque no tengan equivalente externo, 2D íntegro, asistente contextual y móvil desde el inicio. Revisión autenticada de navegación de escritorio realizada en Comet.

## Revisión externa realizada

1. Primera revisión en Chrome aislado: redirige al acceso. Posteriormente se accedió a la pestaña autenticada existente en Comet, como se detalla abajo. Ya no hay un bloqueo de login para la referencia de escritorio.
2. Revisar [página oficial](https://walkmyhome.ai/) y tres ilustraciones públicas: correspondencia plano/volumen, cámara interior con localizador y generación de plano. Son imágenes promocionales, no pruebas de interacción.
3. Abrir la demo desde la página oficial: diálogo de constructor con botones 2D/3D y cierre; iframe público del builder.
4. Abrir [builder público](https://walkmyhome.ai/builder?mobile-demo=1&v=7) a 500 × 844: plano con estancias, selección activa y panel apilado; acciones Walkthrough y Render al pie.
5. Pulsar Home Office en el plano: cambia título de Living Room a Home Office, selección activa, opciones de estancia y vista 3D. Aparecen tamaño, luz, cámara, guardar y deshacer/rehacer.
6. Ampliar a 1440 × 1000: columna izquierda de estancias/categorías, escena dominante a la derecha, barra flotante inferior y acciones de generación al pie.
7. Abrir Materials & finishes, Furniture & decor y Size: comprobar paneles y controles presentes. No ejecutar generación, compra, guardado ni exportación.

La escena 3D visible terminó de mostrar escritorio, silla, estantería y planta. El texto de carga de muebles seguía presente en el árbol accesible; no se tomó como prueba de fallo ni de carga completa de todos los recursos. No se completaron pruebas de arrastre, luz, paseo, render ni persistencia en la demo.

## Hallazgos y prioridad

| Prioridad | Hallazgo                                            | Decisión de Habiteka                                                                         |
| --------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| P1        | Contexto de estancia y escena responden juntos      | Compartir contexto entre Amueblado/3D, propiedades y asistente; preservar 2D.                |
| P1        | Paneles por necesidad reducen búsqueda              | Reutilizar la ranura lateral y dar continuidad a tareas y retorno.                           |
| P1        | Controles de cámara próximos a la escena            | Jerarquía compacta en 3D; no trasladar gestos del plano de la referencia.                    |
| P1        | Paso a resultados visible                           | Acciones de preparación con requisitos, aceptación y coste reales.                           |
| P1        | Móvil necesita una composición propia               | Paneles/hojas y navegación táctil desde cada fase; no aplazarlo al final.                    |
| P2        | Ilustraciones sugieren orientación durante el paseo | Investigar localizador para navegación final; nunca usar maqueta guía como sustituto.        |
| P2        | Web anuncia sol, comprobaciones y costes            | Auditar capacidades y diseñar integración contextual; no asumir exactitud ni disponibilidad. |

## Contraste con Habiteka

Inspección de código: ProjectTabs, StudioStageNav, EditorShell, EditorProjectBar, EditorSidePanel, EditorViewSwitch, view-mode, SceneViewControls, ScenePlanNavigation, FreeWalkOverlay, editor-preferences, VideoStudioWorkspace y tabla de atajos.

Ya existen tres vistas, exclusividad de paneles, controles de cámara, aprobación de plano, aceptación de imágenes y estudio de vídeos. Las rutas conservan zona en varios destinos, pero no constituyen por sí solas el contexto completo de navegación. No se hizo auditoría visual del Habiteka desplegado.

El botón de paseo libre no se ofrece en la llamada actual de SceneViewControls (`canFreeWalk={false}`). Infraestructura de paseo en código no acredita visita final sobre diseños IA. La guía pública confirma esa modalidad continua como pendiente. El diseño final depende de referencias aceptadas, no de una captura del editor.

## Ampliación: editor autenticado en Comet

Se seleccionó la pestaña ya abierta de WalkMyHome Editor y se verificó su correspondencia con la escena solicitada. El árbol accesible exponía controles del navegador, no el contenido completo de la web. Los clics de navegación se comprobaron por su respuesta visual, no por el simple éxito del envío.

| Navegación realizada               | Respuesta comprobada                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Build → Items                      | Catálogo con búsqueda, categoría/tipo y tarjetas con miniatura/dimensiones                                      |
| Items → Materials                  | Búsqueda, categoría, muestras y acceso a materiales personalizados                                              |
| Materials → Visualize              | Entrada al estudio y galería                                                                                    |
| Open Visualize studio → cerrar     | Modal Choose view/Set the look/Results, opciones de cámara, aviso de preparación y retorno                      |
| Visualize → Chat                   | Alcance selección/estancia/planta/proyecto, sugerencias y entrada de texto; no se enviaron mensajes             |
| Chat → Scene → seleccionar entidad | Árbol edificio/planta/entidades, selección, barra cercana e inspector con dimensiones/acciones                  |
| Scene → Tools                      | Tarjetas de acabados, información espacial, presupuesto, luz diurna y comprobaciones; no se ejecutaron cálculos |
| Tools → Import                     | Fuentes/destino y aviso de sustitución; sin subir o reemplazar archivos                                         |
| Walkthrough → Exit walkthrough     | Vista interior que ocupa pantalla, guía de controles y retorno; sin paseo completo ni comandos de puertas       |
| Volver a Build                     | Editor devuelto al panel inicial de construcción                                                                |

No se editaron propiedades/geometría, importaron archivos, enviaron peticiones, generaron imágenes/vídeos ni exportaron resultados. No se probaron guardado, colisiones, rendimiento o móvil de la escena autenticada. Se observó la composición general del Habiteka ya abierto en Comet, sin editarlo; no se guardan sus datos ni capturas en documentación.

Patrón principal: rail por tareas, panel activo, escena dominante, cámara compacta e inspector contextual. Estudio con preparación/configuración/resultados separados. La adopción conserva nuestras opciones, servicios y reglas, también sin equivalente externo. Fase 5 corregida para adaptar funciones propias; nuevos motores/cálculos/exportadores externos quedan fuera del alcance.

## Límites y verificación

No se han medido contraste o rendimiento externos, ni completado teclado, táctil y lector de pantalla. Chrome rechazó el intento inicial de guardar una captura de la demo por su acceso a la ruta local; se conservan enlaces públicos. En Comet se inspeccionaron capturas temporales sin copiarlas al repositorio o manual. No hay captura privada publicada. Una lectura por AppleScript no devolvió resultado y se interrumpió; se continuó por inspección visual.

Verificación documental realizada: `npm run docs:updates` correcto; `npm run docs:build` correcto, Astro sin errores ni avisos y 18 páginas generadas; estructura AK y formato correctos; 18 enlaces locales y 26 rutas verificadas sin errores. Se revisaron las seis fases para conservar 2D, asistente contextual, móvil y aceptación humana. Una compilación del manual no demuestra mejoras UX implementadas.

La invocación de Prettier con pnpm activó una sincronización automática de dependencias. Se interrumpió; se retiró con parche la única diferencia del lockfile y se restauraron las cuatro carpetas de paquetes movidas por esa operación. El formateador local se ejecutó después sin instalación. El diff final de esta tarea solo contiene documentación y plan; el script temporal preexistente se conserva.

## Cuestiones abiertas

La ampliación Comet pasa `docs:updates`, `docs:build`, estructura AK y formato. Se comprobaron 10 documentos, 18 enlaces locales y 26 rutas sin errores. Las seis fases conservan el alcance exclusivamente visual y equivalencia funcional completa; no quedan bloqueadas por login.

- Validar prototipo e inventario completo de equivalencia funcional, incluida cada opción propia sin equivalente externo.
- Ampliar evidencia móvil autenticada si hace falta; no reabrir alcance visual, 2D, asistente contextual o prioridad móvil confirmados.
