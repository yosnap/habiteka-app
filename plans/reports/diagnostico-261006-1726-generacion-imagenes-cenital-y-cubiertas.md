# Diagnóstico: generación de imágenes del Estudio de diseño (proyecto Test 6)

Fecha: 2026-10-06. Proyecto `cmuue9sxw000jwfms2eekyvkz`, revisión del plano 49. Solo lectura: no se ha cambiado código.

## Resultado

La generación de la cenital está rota desde el commit `854759a` (06/10 14:30), que subió el prompt de la cenital de `habiteka-plan-simple-v3` a `v4`. La v3 generó ayer cenitales aprobadas con gpt-image-2 (KIE). La v4 añade dos inventarios JSON en bruto y el prompt pasa a 21 444 caracteres. Con eso fallan los tres modelos KIE y la cadena cae en Gemini 3 Pro Image, que reinventa la distribución.

## Lo que pasó en cada intento

| Hora (Madrid) | Generación | Revisión visual | Resultado |
|---|---|---|---|
| 17:08 | KIE ×3 fallan; Gemini 3 Pro Image falla | — | Error, sin coste |
| 17:09 (el tuyo) | KIE ×3 fallan; Gemini 3 Pro Image genera (0,12 $) | OpenRouter `gateway_down` a los 18 s; NaN qwen3.8-flash agota el tiempo (245 s) | Error mostrado; la imagen pagada se pierde (no queda en MinIO) |
| 17:25 (mi prueba) | KIE ×3 fallan; Gemini 3 Pro Image genera (0,12 $) | Gemini 3.7 Flash responde (0,046 $) | Imagen guardada y **descartada** con razón |

Fallos de KIE, idénticos en los tres intentos: gpt-image-2 devuelve `api_500` en 2 s, y Flux flex y Flux pro rechazan el prompt en local porque supera su límite de 5000 caracteres.

La imagen de Gemini cambia la distribución: traslada la cochera, convierte el dormitorio 3 en terraza, mueve la cocina, deja un inodoro por baño y escribe rótulos. La auditoría acierta al descartarla.

## Hallazgos

1. **Prompt de la cenital (v4) demasiado largo.** `simplePlanPrompt` añade `exteriorPlanRule` (unos 14 000 caracteres de JSON con UUID y coordenadas de 14 decimales) y `criticalFixtureRule` (unos 4000). Esto contradice el propio diseño del fichero, que documenta que un prompt de miles de caracteres empeora el resultado. Que gpt-image-2 dé 500 por la longitud es probable, pero no está confirmado, porque el mensaje de KIE no se guarda.
2. **Muebles omitidos en la cenital.** `MAX_ITEMS_PER_ROOM = 6` (`furniture-views.ts`) recorta por orden del documento. En SALA / COMEDOR entran la cafetera y el frigorífico, y se quedan fuera la chimenea, el mueble de TV, el televisor, las 6 sillas, los 6 taburetes y la campana. También se cuela el sufijo interno «· modelo 3d».
3. **«Exterior terminado» no describe la cubierta.** La captura 3D muestra la cubierta a cuatro aguas, la claraboya de cristal y la chimenea. El prompt (unos 34 000 caracteres) no menciona tipo, pendiente, material, claraboya ni chimenea, y la auditoría no comprueba la cubierta. `render-contract.ts` sí tiene los huecos de cubierta, pero solo lo usan el flujo antiguo `generateDesignFromEditor` y las evidencias de calidad.
4. **El modo Controlado no se respeta en la cenital.** El prompt de Controlado es idéntico al de Libre: no limita a las categorías marcadas.
5. **Una imagen pagada se pierde si la revisión falla por el proveedor.** `reviewRenderFidelity` relanza cualquier error que no sea un rechazo, y la imagen ya cobrada no se guarda.
6. **Vistas con captura 3D (isométrica, frontal, dron, exterior): prompts de 34 000–35 000 caracteres.** El bloque «Datos del plano» ocupa unos 25 000. No se ha probado si gpt-image-2 los acepta hoy.
7. **«Solo la casa» y «Zonas concretas»** no usan el plano 2D en la cenital: van por captura 3D con máscara y por el prompt largo.

## Datos del plano que la IA reproducirá tal cual

- Cada baño tiene 3 inodoros y 2 lavabos: símbolos importados más modelos añadidos, solapados. La auditoría exige esas cantidades.
- El material del tejado es `ambientcg:Carpet012`, una moqueta. El selector de la cubierta admite cualquier material de superficie.
- La chimenea de la cubierta (x 8855, y 11947) está a unos 2,3 m de la chimenea del salón (x 6553, y 12115).
- No hay techos ni luminarias definidos (`ceilings` y `luminaires` vacíos), así que esta prueba no cubre los techos.

## Coste de la sesión

Tu intento de las 17:09 costó 0,12 $ y se perdió. Mi prueba costó 0,12 $ de la imagen y 0,046 $ de la revisión, y la imagen está guardada como descartada en Diseños.

## Preguntas abiertas

- ¿Se compactan los inventarios a frases cortas en la cenital o se quitan del prompt y se dejan solo para la auditoría?
- Si la revisión falla por el proveedor, ¿se guarda la imagen como «sin revisar», sin poder aceptarla hasta reintentar la revisión?
- ¿Se limita el selector de material del tejado a materiales de cubierta?
