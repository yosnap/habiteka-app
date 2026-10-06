# Prueba real: cenital v5 y cierre de tejado (Test 6, revisión 49)

Fecha: 2026-10-06. Plan: `plans/261006-1537-cenital-y-tejado-desde-modelo/`.

## Resultado

La cenital vuelve a generarse con la primera ruta configurada (KIE gpt-image-2), con un prompt de 3165 caracteres en lugar de 21 444. En modo Libre pasó los 7 criterios de la auditoría. En Controlado, con solo Plantas, conservó la planta y añadió únicamente plantas, pero la revisión devolvió un informe incompleto del exterior: la imagen se guardó como «Descartado» con el motivo, en lugar de perderse como antes.

## Intentos (hora UTC)

| Hora | Modo | Generación | Revisión | Resultado |
|---|---|---|---|---|
| 16:05 | Libre | KIE gpt-image-2, 94 s, 0,08 $ | Gemini 3.7 Flash, 0,039 $ | Superada (7/7 criterios) |
| 16:17 | Controlado (Plantas) | KIE gpt-image-2, 56 s, 0,08 $ | Gemini 3.7 Flash, 0,048 $ | Informe incompleto del exterior. **Imagen perdida**: el caso no estaba cubierto todavía |
| 16:22 | Controlado (Plantas) | KIE gpt-image-2, 53 s, 0,08 $ | Gemini 3.7 Flash, 0,048 $ | Mismo informe incompleto; **imagen guardada** como Descartado con el motivo |

Antes del cambio (15:08–15:26), los tres modelos KIE fallaban (`kie_prompt_too_long` y `api_500`). Gemini 3 Pro Image reinventaba la distribución y la auditoría la descartaba.

## Hallazgos de la prueba

- La revisión con Gemini 3.7 Flash deja a menudo sin comprobar algún elemento exterior: 2 de 3 revisiones hoy. Test 6 tiene 28 elementos exteriores (cada tramo de seto y cada arbusto cuentan por separado). Es un límite de la auditoría, no del generador. Agrupar los elementos repetidos en el informe pedido al auditor reduciría estos descartes.
- La primera captura 3D tras abrir el editor agotaba su plazo en la pestaña de pruebas, que estaba en segundo plano: Chrome frena la animación. Con la pestaña activa funciona a la primera. No es un fallo de la app.
- El cierre de tejado no se ha probado en real: necesita una cenital aceptada (para la isométrica) y una isométrica aceptada. Aceptar requiere la autorización de Paulo.

## Coste de las pruebas del día

Unos 0,54 $ en total: 0,17 $ del diagnóstico inicial, 0,12 $ de Libre y 0,26 $ de las dos de Controlado.

## Cierre de tejado: prueba ampliada (18:40–19:00, hora de Madrid)

- Con la autorización de Paulo se aceptó la cenital en Libre de Test 6 (`…36557fa4`, 16:42 UTC).
- La isométrica de **Toda la planta** no se pudo generar: exige una ortofoto de la parcela (`droneReferences`) y Test 6 no tiene emplazamiento confirmado. No se subió ninguna imagen sustituta.
- Proyección sobre imágenes reales de otro proyecto (`cmu7nm84…`), sin coste ni cambios:
  - Las isométricas y drones de **zonas aisladas** (`renders/zones/…`) recortan la referencia a la zona: salen en 4:3 o 1:1 y no se pueden encajar. La acción ya las rechaza.
  - Una isométrica de toda la planta sin aislar (`ee02f550`, revisión 144) sí sale en 21:9, como su cámara. Aun así, la coronación de muros proyectada con la cámara guardada queda unas 2–3 veces más pequeña que la casa dibujada: **la IA reencuadró la vista**, y la cámara guardada no basta para colocar el tejado.
  - Un alineado automático por bordes (escala y desplazamiento) no es fiable: encontró un mínimo falso.
- Conclusión: la proyección es correcta (escena en mm/1000, sin centrado), pero solo encaja si la imagen aceptada conserva el encuadre de su captura, y hoy eso no está garantizado en las vistas lejanas. Queda pendiente la decisión de Paulo sobre cómo seguir.

## Vistas con captura 3D: misma regresión (21:15–21:35, hora de Madrid)

- Dos cenitales de otro proyecto con zonas seleccionadas (Estricto y Controlado, 20:15 y 20:21) usaron la captura 3D con máscara (`image-from-capture-v25`). Los tres modelos KIE fallaron (`api_500` y `prompt_too_long`), Gemini 3 Pro Image reinventó la planta y la revisión las descartó.
- Causa: el commit `854759a` (06/10) añadió al prompt de captura el inventario JSON del exterior (unos 12 300 caracteres en ese proyecto) y de los sanitarios (unos 2800). El prompt llegó a 28 500 caracteres; en Test 6, a 34 000–35 600. Hasta el 05/10 KIE aceptaba esas vistas.
- KIE devuelve 500 aunque la documentación de GPT Image 2.5 admite 32 000 caracteres; recomienda no pasar de 8000 tokens, y el JSON con UUID y coordenadas gasta muchos tokens. El mensaje exacto de KIE no se guarda.
- Arreglo (`habiteka-image-from-capture-v26`): el generador recibe el exterior y los sanitarios en frases breves y sin posiciones, con las políticas completas; con zonas, solo lo que cae dentro. La auditoría conserva el inventario completo. Resultado: 13 800 y 11 700 caracteres en ese proyecto y 17 200–18 300 en Test 6.
- Pendiente: la generación real de comprobación (Test 6, Solo la casa, Cenital, Controlado). El permiso automático bloqueó el clic de gasto; queda para Paulo.
