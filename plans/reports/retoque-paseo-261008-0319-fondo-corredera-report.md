# Retoque localizado del paseo

## Objetivo

Corregir el fondo inventado del patio con un solo intento restante, conservando
los demás píxeles. Gasto previo: 1,39885550 USD de 3 USD autorizados; diez de once
imágenes consumidas. Vídeo de hasta 60 s, separado de construcción, máximo 2 EUR.

## Implementación

- Reutilización de `protectedInpaint` y `RenderRegionImage` en el paseo.
- Nueva opción «Corregir solo una zona» para imágenes descartadas: exige guía
  preparada y comprobada, selección, instrucción y consentimiento de gasto.
- Validación en servidor del borrador exacto, máscara, ámbito, cámara, referencias
  y coste. No permite más de media imagen ni genera tramos automáticamente.
- Opción de borrar el contenido antes de rellenar; evita que el objeto inventado
  siga condicionando el modelo. Apariencia aceptada y geometría acompañan el prompt.
- Auditoría completa posterior, historial y `imageEdit` con píxeles protegidos.
  Ninguna aceptación automática ni sustitución del resultado por un render 3D.

## Validación

- 23 tests de máscara, coste/enrutado, vinculación y contrato regional pasaron.
- TypeScript, ESLint, `docs:updates`, `docs:build` y `git diff --check` correctos.
- Prueba real desde navegador: selección del interior de la corredera y borrado
  del fondo. Evidencia `/tmp/habiteka-patio-retoque-seleccion.png`.
- Resultado guardado: `del-cmuue9sxw000jwfms2eekyvkz-visit-8ac7a884-6f38-494e-8d3e-b1b50f333787`.
- Imagen local: `/tmp/habiteka-patio-retoque-local.png`. Desaparecen la galería,
  cómoda, cuadro y alfombra; ahora hay pared cercana y franja corta de suelo.
- Verificación de píxeles 2048×1152: 0 píxeles exteriores modificados; 58.367
  interiores cambiados de 58.368 seleccionados. Conserva 2.300.928 píxeles.
- Coste del intento y análisis: 0,15767000 USD; acumulado 1,55652550 USD.
  Once intentos consumidos; no se genera ninguna imagen adicional.
- Primera auditoría rechaza por altura vegetal inferida de la cenital y por
  escritorio visible por ventana pero no por puerta. El comparador conjunto
  describe correctamente la vegetación y el estudio. Se corrigen las reglas de
  visibilidad del análisis aislado; nueva revisión sobre la misma imagen pasó.
- Reauditoría: 0,06525450 USD. Acumulado final **1,62178000 USD**, once intentos;
  ningún vídeo nuevo, ninguna aceptación. Versión 2 conserva el informe previo.
- 16 tests adicionales de lectura aislada, descripción y retoque pasaron; lint y
  documentación comprobados tras el ajuste de visibilidad.
- UI confirma «Auditoría completada. Falta tu revisión y aceptación del encuadre».
  Evidencia `/tmp/habiteka-patio-retoque-validado-ui.png`.

## Pendiente

La región se inspeccionó visualmente y desapareció el fondo inventado; también se
comprobó la igualdad exterior. Quedan aceptación humana del patio y entrada, nueve
encuadres sin generar y validación temporal del vídeo. Los once intentos autorizados
están consumidos: para una imagen nueva hace falta ampliar ese número, aunque quede
margen monetario dentro de 3 USD. No se inicia gasto adicional automáticamente.
