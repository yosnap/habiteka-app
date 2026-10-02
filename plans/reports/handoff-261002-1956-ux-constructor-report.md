# Continuación: UX del constructor de Habiteka

## Petición y estado

El usuario quiere continuar en una nueva sesión. La primera adaptación visual está implementada en local; todavía falta revisar y mejorar la experiencia completa. No dar el rediseño por terminado.

- Repositorio: Habiteka, rama `feat/publicidad-vertical-cotas`.
- Último commit al cerrar esta ronda: `60b7966`.
- Hay cambios sin commit de cuatro rondas: página independiente de Vídeos, constructor visual, propiedades/selección y lienzo/vistas.
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
- Catálogo por Habitaciones y Categorías con ilustraciones SVG propias, búsqueda, filtros y variantes; permanece abierto al interactuar con el lienzo.
- Construir con tarjetas; acceso directo Exterior para jardín, terreno y pavimento.
- Cabecera con planta, deshacer/rehacer, guardar, Vídeos y Diseñar con IA. Herramientas agrupa preparación, tejado, parcela y aprobación.
- Vistas renombradas a Plano 2D, Amueblado y Modelo 3D.
- Asistente y entrada de planos con tarjetas visuales; pestañas del proyecto con iconos.
- Cursor compartido para controles interactivos, incluidas opciones de ModernSelect.
- Documentación actualizada en `docs/site/src/content/docs/`.

## Siguiente ronda, en este orden

1. **Propiedades y selección — implementado en la continuación del 2 de octubre**: panel persistente, Medidas/Acabados/Notas, barra inferior compacta, campos comunes de selección múltiple y acceso a elementos de una selección mixta. Ver `ux-261002-1957-propiedades-seleccion-report.md`. Verificados pared, habitación, puerta y mueble en muestra aislada; 71 pruebas, tipos, lint, documentación y build. Sigue pendiente la valoración visual del usuario.
2. **Lienzo y vistas — implementado el 3 de octubre**: paneles con espacio propio, selección/Propiedades conservadas entre vistas, controles de Amueblado, Mano sin cancelar, colocación entre ambos planos y cámara estable durante edición. Ver `ux-261003-0106-lienzo-vistas-report.md` para validación y límites. El encuadre manual de Amueblado/3D sigue reiniciándose al salir de esas vistas; documentado.
3. **Diseños y generación**: unificar presentación de tandas, nombres de zona/vista, revisión y aceptación; comprobar acceso a las acciones de imagen dentro de su modal. Mantener trazabilidad de la aprobación.
4. **Vídeos de principio a fin**: comprobar orientación y continuidad desde los diseños aceptados hasta Construcción, Publicidad y Primera persona. Hacer visibles los requisitos y motivos de bloqueo; la pieza combinada y el paseo continuo siguen pendientes funcionales.
5. **Consistencia y accesibilidad**: tamaños, iconos, colores, cursor, estados activos/deshabilitados, foco de teclado, estados vacíos/errores y responsive. Probar en móvil real cuando esté disponible.

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
- Sin commit, merge ni despliegue de estas rondas todavía; revisar el diff conjunto antes de prepararlos. La continuación de propiedades tampoco está confirmada en git.
- Usar CUA para navegador. La extensión de control del navegador fallaba; el control nativo funcionó. No emplear alternativas no autorizadas.
- Para comandos: usar binarios locales, por ejemplo `./node_modules/.bin/tsc --noEmit`; no `pnpm exec` si activa instalaciones.
- Las pruebas se ejecutaron contra BD local aislada y marcada. No resetear la BD de desarrollo ni producción.
- No escribir memoria MCP mientras no exista identidad de sesión registrada por el host.

## Preguntas pendientes

Ninguna necesaria para empezar Diseños y generación. Propiedades/selección y lienzo/vistas ya cuentan con una ronda implementada y documentada; queda valoración visual del usuario.
