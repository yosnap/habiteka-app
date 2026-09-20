# Estudio de planos — validación del 8 de septiembre de 2026

## Objetivo y decisión

Plano fiel y editable → medida real del usuario → amueblar → cenital condicionada.
El 3D inmersivo sigue congelado. No se cambia el stack: Next/React, Konva, Prisma,
PostgreSQL, Sharp, MinIO y OpenRouter permiten completar estos recorridos sin otra migración.

No se declara la aplicación lista para producción ni fidelidad universal.
Una imagen generada atractiva no acredita que respete un plano.

## Cambios realizados

- Persistencia del estudio en `Project.studioState`, con aislamiento por organización y proyecto vivo.
  Migración `20260907223000_project_studio_state`, aplicada en desarrollo y BD de prueba.
- Original, plano, editable, escala, cenital y detalles se recuperan al volver al proyecto.
  URLs de almacenamiento firmadas de nuevo al cargar.
- Dibujo SVG con muros rectos/lápiz, deshacer y exportación. Conversión ortogonal offline:
  no usa un modelo generativo para reconstruir lo que el usuario ya dibujó.
- Carga de PNG/JPEG/WebP normalizada a 2048 px; captura de errores, límite de acción 16 MB
  para transportar imágenes base64. Subir conserva el original; redibujar es opcional.
- Importación del canvas amueblado como referencia directa. No se eliminan muebles mediante IA.
- Rasterizador y serialización respetan el origen de rotación Konva; bounds rotados correctos.
  Símbolos de mobiliario reconocibles; sofá/sillas de plantilla dentro del recinto y sin solapamiento.
- Detector de muros admite poché grueso y no fusiona una fachada con el canto perpendicular.
- Escala corregible repetidamente y persistida. Se ocultan cotas hasta disponer de medida confirmada.
- Protección contra doble clic concurrente, confirmación antes de reemplazar canvas.
- Corrección de fuente CSS autocircular y enlaces/pestañas de contraste casi blanco.
- Mis proyectos abre el estudio y usa sus imágenes como portada, con URLs renovadas.

## Pruebas verificadas

Navegador utilizado: **Comet**, pestaña existente de Habiteka. La conexión de la extensión
se identifica como Chromium/Chrome en la herramienta, pero corresponde a Comet; se verificó
la aplicación nativa y sus pestañas. No se continuó abriendo Chrome tras la indicación del usuario.

| Prueba | Resultado |
|---|---|
| Login de desarrollo y crear proyecto con plantilla | Correcto |
| Canvas amueblado → estudio | Correcto; revisión visual de posiciones |
| Cuatro muros arrastrados en dibujo → editable sin IA | Correcto; 4 muros, sin vanos añadidos |
| Aplicar ancho 6 m → recargar → editable | Correcto; cota 6.00 m conservada |
| Confirmar envío → editor | Correcto; ruta editor cargada, sin errores de consola observados |
| Canvas → cenital real | Petición y persistencia correctas; fidelidad insuficiente en 2.5 |
| Subida por selector de archivos de Comet | Pendiente: extensión rechaza `setFiles` con `Not allowed` |
| Suite completa en BD aislada | 765 correctas, 5 omitidas; 108 archivos correctos, 4 omitidos |
| ESLint de los módulos nuevos/principales modificados | Correcto |
| Compilación de producción y comprobación TypeScript final | Correctas |

La suite se ejecutó sobre `habiteka_test_20260908`, **no sobre desarrollo**: helpers de tests
truncan tablas y algunas pruebas eliminan configuraciones de modelos. No ejecutar la suite
con la URL de la BD personal ni usar el seed como mecanismo de validación.

El lint global tenía 29 errores y 16 advertencias previos, principalmente en el área 3D legacy.
No se han ocultado ni corregido con excepciones de lint.

Proyectos de prueba creados mediante interfaz:

- `cmtrt4y7q0000yrmsfbdret5e`: Validación planos septiembre.
- `cmtrtjd430002yrmsa9ohf25k`: Validación boceto y canvas; se reemplazó únicamente su canvas de prueba.

## Benchmark real y limitaciones

`scripts/verify-studio-live.ts <projectId> [model]` es opt-in: realiza llamadas facturables.
Se probaron el modelo configurado `google/gemini-2.5-flash-image` y, solo en el benchmark,
`google/gemini-3.1-flash-image`. No se cambió la configuración global de modelos.

- 2.5: cenital en unos 9 s, pero duplicó un sofá. En prueba de dibujo rectangular añadió una vivienda completa.
- 3.1: cenital en unos 14 s con número de muebles más fiel; el redibujado añadió puerta/ventana a un recinto cerrado.
- Por tanto, ninguna de estas dos muestras valida redibujado fiel de cualquier plano.
- El dibujo y canvas evitan ahora esa reinterpretación. Las fotografías conservan el original
  y muestran aviso para comparar antes de usar un redibujado.
- La extracción ortogonal no certifica diagonales, curvas, perspectivas o planos de baja calidad.
  El editor permite retoque; la medida introducida fija escala, no convierte una foto en levantamiento técnico.

Artefactos: `studio-live-260908/` y `studio-live-260908-google-gemini-3-1-flash-image/`.
Los `geometry.json` del benchmark se generaron antes del último ajuste del detector;
se conservan como evidencia del fallo, no como resultado final corregido.

## Próxima puerta de aceptación

1. Completar subida manual/automatizada en Comet y repetir con JPG grande y PNG de plano.
2. Banco offline de planos aportados por el usuario: contrastar perímetros, huecos, diagonales,
   escala y entrada al editor. No gastar créditos para ajustar detección de píxeles.
3. Benchmark pequeño y acotado de cenital sobre esos mismos planos amueblados;
   aprobar modelo por fidelidad, latencia y coste observado, no por estética aislada.
4. Revisar facturación/observabilidad de acciones del estudio y los errores legacy antes de producción.
5. Probar tamaños móviles, fallos de proveedor/almacenamiento, doble pestaña y renovación prolongada de referencias.

## Referencias consultadas

- [OpenRouter: generación de imágenes](https://openrouter.ai/docs/guides/overview/multimodal/image-generation):
  referencia de imagen y `image_config.aspect_ratio`; se corrigió que el adaptador descartaba el aspecto.
- [Konva: dibujo libre](https://konvajs.org/docs/react/Free_Drawing.html).
- [Konva: exportación de canvas](https://konvajs.org/docs/react/Canvas_Export.html).

No se incorporaron dependencias nuevas: se reutilizó la infraestructura instalada.
