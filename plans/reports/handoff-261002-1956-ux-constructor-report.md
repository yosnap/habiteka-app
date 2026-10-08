# Continuación: UX del constructor de Habiteka

## Petición y estado

El usuario quiere continuar en una nueva sesión. La primera adaptación visual está implementada en local; todavía falta revisar y mejorar la experiencia completa. No dar el rediseño por terminado.

- Repositorio: Habiteka, rama `feat/publicidad-vertical-cotas`.
- Commit base: `c11fcf6` (`feat(editor): unify builder UX and video navigation`), creado a petición del usuario. Incluye página independiente de Vídeos, constructor visual, propiedades/selección y lienzo/vistas; sin push ni despliegue.
- Las rondas posteriores de Diseños/generación, flujo de Vídeos y consistencia/accesibilidad están en `0533319` (`feat(editor): improve design review and video workflow accessibility`). Sin push ni despliegue.
- La ronda de superficies, Medir y catálogo realista solicitada después de ese commit está implementada localmente; ver `ux-261003-0752-superficies-medicion-catalogo-report.md`. No incluir material privado al preparar su commit.
- La ampliación de imágenes a Construir/terreno/pavimento y la corrección de filtros y buscador también están en local, sin commit; ver `ux-261003-0855-construir-exterior-buscadores-report.md`.
- Restablecer muestra ahora reinicia el editor local completo, confirma la acción y conserva Deshacer; ver `fix-261003-0938-restablecer-muestra-report.md`. También sin commit.
- Preservar todos los cambios existentes. No hacer reset ni sobrescribirlos.
- Informes: `plans/reports/ux-261002-estudio-video.md` y `plans/reports/ux-261002-1934-constructor-visual-report.md`.
- Hay imágenes e informes privados sin seguimiento en `plans/reports/`; no incluirlos en commits o documentación pública por defecto.

## Requisitos del usuario

1. Experiencia coherente y clara desde Asistente y Plano hasta Editor, Diseños y Vídeos. Acciones fáciles de localizar, pocas vueltas y salidas claras.
2. Referencia: organización visual de Planner 5D, especialmente habitaciones, categorías, construcción, colores e iconografía. Se revisó la sesión del usuario en Comet; no guardar su enlace con token de acceso.
3. Botones, enlaces y tarjetas clicables con cursor de mano. Opciones deshabilitadas claramente diferenciadas.
4. Todos los vídeos, visitas e inmersión final deben partir de renders IA aceptados explícitamente por el usuario. El modelo 3D del editor sirve como guía. Nunca sustituir un vídeo final por grabación del modelo nativo.
5. Actualizar documentación de usuario con cada implementación; solo funciones reales y sin información privada.

## Ya implementado

- Página Vídeos independiente con navegación del proyecto, Volver al editor y Mis diseños. Preparación en pasos; funciones pendientes identificadas.
- Editor permanece en edición al entrar o aprobar. Revisión aprobada explícita.
- Catálogo por Habitaciones y Categorías con miniaturas realistas propias (SVG de respaldo), búsqueda, filtros y variantes; permanece abierto al interactuar con el lienzo.
- Construir con tarjetas; acceso directo Exterior para jardín, terreno y pavimento.
- Cabecera con planta, deshacer/rehacer, guardar, Vídeos y Diseñar con IA. Herramientas agrupa preparación, tejado, parcela y aprobación.
- Vistas renombradas a Plano 2D, Amueblado y Modelo 3D.
- Asistente y entrada de planos con tarjetas visuales; pestañas del proyecto con iconos.
- Cursor compartido para controles interactivos, incluidas opciones de ModernSelect.
- Documentación actualizada en `docs/site/src/content/docs/`.

## Siguiente ronda, en este orden

1. **Propiedades y selección — implementado en la continuación del 2 de octubre**: panel persistente, Medidas/Acabados/Notas, barra inferior compacta, campos comunes de selección múltiple y acceso a elementos de una selección mixta. Ver `ux-261002-1957-propiedades-seleccion-report.md`. Verificados pared, habitación, puerta y mueble en muestra aislada; 71 pruebas, tipos, lint, documentación y build. Sigue pendiente la valoración visual del usuario.
2. **Lienzo y vistas — implementado el 3 de octubre**: paneles con espacio propio, selección/Propiedades conservadas entre vistas, controles de Amueblado, Mano sin cancelar, colocación entre ambos planos y cámara estable durante edición. Ver `ux-261003-0106-lienzo-vistas-report.md` para validación y límites. El encuadre manual de Amueblado/3D sigue reiniciándose al salir de esas vistas; documentado.
3. **Diseños y generación — implementado el 3 de octubre**: estados y recuentos de revisión en la galería, ámbitos diferenciados, fecha de aceptación, visor con panel lateral y manejo de teclado aislado del generador. Ver `ux-261003-0139-disenos-generacion-report.md`. Las rondas siguientes verificaron el modal en escritorio y al 250 %, flechas, formulario, cierre y foco; la ronda de accesibilidad añade Escape desde el campo de cambios y anidamiento de la previsualización local.
4. **Flujo de Vídeos — implementado el 3 de octubre**: requisitos antes de preparar, bloqueo de mezclas de tandas, actualización de fuentes/tareas, salidas a resultados y publicidad, estados vacíos y guía corregidos. Ver `ux-261003-0206-flujo-videos-report.md`. Verificados navegación y bloqueos sin generar medios ni aceptar referencias. La pieza combinada y el paseo continuo siguen pendientes funcionales.
5. **Consistencia y accesibilidad — implementado el 3 de octubre**: marco modal con trampa y retorno de foco, cierre explícito, Escape anidado, pestañas de Vídeos con flechas y estados accesibles. Ver `ux-261003-0709-accesibilidad-consistencia-report.md`: 65 pruebas, tipos, lint, documentación, build y CUA a 390 × 740. Móvil real y lector de pantalla siguen pendientes.
6. **Superficies, Medir y miniaturas — implementado el 3 de octubre tras el feedback**: terreno/pavimento con ocho tiradores, movimiento, imanes y guías en Plano 2D y Amueblado; selección por marco y flechas; cotas con instrucciones, distancia durante el gesto, selección final y búsqueda. Nueve habitaciones y doce categorías con imágenes genéricas generadas con IA. Ver `ux-261003-0752-superficies-medicion-catalogo-report.md`: 39 pruebas, tipos, lint, documentación, build aislado y CUA sobre muestras independientes. Valoración visual del usuario pendiente.
7. **Construir, Exterior y buscadores — implementado el 3 de octubre tras nuevas capturas**: catorce imágenes genéricas para categorías y acciones de superficies; filtros de Exterior en filas separadas y margen antes de las fichas; búsqueda de Propiedades con un único borde y separación del selector. Ver `ux-261003-0855-construir-exterior-buscadores-report.md`: cinco pruebas, tipos, lint, documentación, build aislado y CUA; regresión visual de Amueblar revisada. Pendiente valoración visual del usuario.

Primero observar cada flujo actual y fijar el problema concreto. Mantener las mejoras de la primera ronda. No prometer fidelidad audiovisual ni funciones pendientes por cambiar etiquetas o estilos.

## Verificación realizada

- TypeScript y ESLint correctos.
- 23 pruebas en 5 archivos: catálogo, búsqueda, paneles, atajos y preferencias.
- Next.js compilado correctamente en checkout aislado de verificación.
- `npm run docs:updates`, `npm run docs:build` y `git diff --check` correctos.
- Navegador local: catálogo, filtros, búsqueda, Exterior, Herramientas, Tejado y selector, Asistente, Plano existente, Editor → Vídeos → Editor.
- Reflujo con ventana estrecha y texto ampliado; restaurados tamaño y zoom. No equivale a prueba táctil/móvil real.
- Las tarjetas de entrada del Plano se revisaron en código/compilación; no se reinició el plano privado para probarlas.
- Navegador quedó en el editor local con Amueblar abierto. No se añadieron objetos ni generaron medios.

## Precauciones de ejecución

- Seguir AGENTS.md: español, parches, archivos de código menores de 1000 líneas, documentación obligatoria.
- `editor-shell.tsx` tiene unas 910 líneas tras extraer el selector de vistas. En la continuación se retiraron los estilos de la antigua barra de medidas de `editor.module.css`; propiedades usa componentes y estilos propios pequeños. Extraer antes de ampliar el shell.
- No generar medios ni habilitar gasto IA en esta continuación sin autorización aplicable. No reutilizar autorizaciones anteriores ya consumidas.
- La base visual, propiedades/selección y lienzo/vistas están en `c11fcf6`. Diseños/generación, flujo de Vídeos y accesibilidad se agrupan en el commit posterior autorizado. No se ha hecho push, merge ni despliegue.
- Usar CUA para navegador. La extensión de control del navegador fallaba; el control nativo funcionó. No emplear alternativas no autorizadas.
- Para comandos: usar binarios locales, por ejemplo `./node_modules/.bin/tsc --noEmit`; no `pnpm exec` si activa instalaciones.
- Las pruebas se ejecutaron contra BD local aislada y marcada. No resetear la BD de desarrollo ni producción.
- No escribir memoria MCP mientras no exista identidad de sesión registrada por el host.

## Preguntas pendientes

Ninguna necesaria para cerrar el commit. Mantener los límites de los reportes: móvil real, lector de pantalla y recorridos con medios aceptados siguen sin validación completa. Escape anidado se verificó con previsualización local y desplegable; la galería posterior a una generación anidada se revisó en código. La aceptación y fidelidad audiovisual requieren decisión y revisión del usuario.
