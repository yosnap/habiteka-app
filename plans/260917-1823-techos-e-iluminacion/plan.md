---
title: Techos editables e iluminación por estilo
priority: P1
effort: medium
branch: feat/planos-ia
tags: [editor-v2, techos, iluminacion]
created: 2026-09-17
status: in-progress
---

# Techos editables e iluminación por estilo

Fecha: 2026-09-17. Implementación local disponible; validación externa pendiente.
Petición: aplazar mobiliario importado y avanzar con techo e iluminación.

## Experiencia propuesta

Un techo por estancia, con vista oculta, semitransparente o sólida. La transparencia
es una ayuda de edición para ver el interior y colocar luminarias; no obliga a que
el material del render sea cristal. Propuesta inicial: techo plano o falso techo
plano con descenso configurable; geometrías escalonadas y molduras, más adelante.

El usuario elige estilo (incluidos moderno y mediterráneo), tipo de techo y si
quiere proponer iluminación automáticamente. Puede revisar y editar la propuesta.
El falso techo y las luminarias aceptadas quedan en el documento, no solo en una
imagen. Un render decorativo adicional se identifica como propuesta visual.

## Situación comprobada después de implementar

- Contrato `EditorDocument` v8 con colecciones explícitas `ceilings`/`luminaires`.
  La incorporación es optativa; abrir un documento antiguo no añade techos.
- Panel «Techo y luces», geometría 2D/3D, anclaje y edición por estancia/planta.
- Propuesta LOCAL DETERMINISTA por estilo, editable antes de aceptar; no modelo
  IA remoto. Preserva luminarias anteriores y valida la aplicación como conjunto.
- Los prompts comparten contexto persistido de techos/luminarias. Esto no prueba
  que un proveedor externo reproduzca exactamente la geometría.
- SceneLighting día/atardecer/noche permanece como ambiente independiente.

## Seguimiento de la entrega

| Bloque | Evidencia / alcance |
|---|---|
| Techo y contrato | v8, plano/falso techo, descenso/color, exclusión exterior, aviso de asociaciones ambiguas |
| Luminarias | Colgante/plafón/foco, coordenadas y caída, temperatura/flujo/encendido, 2D/3D |
| Propuesta y prompts | Motor local moderno/mediterráneo; aceptar/revisar/descartar; contexto en rutas de render |
| Validación | QA automatizada y prueba de navegador parcial; detalle en informe de progreso |

No hay archivos `phase-XX-*.md` en este plan: el barrido completo abarca este
archivo. Los requisitos originales se conservan abajo para no ocultar diferencias
de alcance. Pendientes explícitos: orientación de luminarias (los cuerpos actuales
son simétricos), canaletas/foseados y propuesta mediante IA externa si se decide
ampliar el motor local. La validación de imágenes de proveedor no está completada.

## Requisitos originales y referencia de alcance

### 1. Techo por estancia y representación transparente

- Diseñar contrato versionado y migración de documentos existentes. Referencia a
  planta y estancia, altura inferior, descenso/acabado; sin modificar Plano2dPayload.
- Reutilizar el contorno interior; excluir patios/terrazas abiertos. No inferir un
  techo sobre un exterior solo porque el recinto tenga suelo o esté cerrado.
- Altura coherente con muros/planta y forjados; evitar superficies duplicadas.
- Modos de visualización independientes del material. Contorno seleccionable y
  plano semitransparente que no intercepte la selección de muebles por defecto.
- Inspector mínimo: activar techo, plano/falso techo, descenso, acabado.
- Si una estancia cambia, reconciliar identidad y contorno. Si se divide/fusiona,
  conservar asociaciones inequívocas y avisar sobre las que requieren revisión.

### 2. Luminarias ancladas

- Catálogo inicial: colgante, plafón, foco empotrado; tira indirecta después si
  existe soporte geométrico real para la canaleta/foseado que la aloja.
- Anclaje a techo/estancia, posición en planta, caída, orientación, encendido,
  temperatura de color e intensidad. No confundir elevación desde suelo con caída.
- Al variar el techo, ajustar altura de la luminaria conservando su anclaje.
- Validar volumen, altura libre, pertenencia a estancia y obstáculos; foco
  empotrado compatible con espesor disponible. Avisar ante pérdida del soporte.
- Símbolos en 2D y geometría/luz en 3D. Límites de luces con sombra para rendimiento.

### 3. Propuesta automática y prompts según estilo

- Opción «Proponer iluminación» por estancia y estilo, separada del ambiente
  día/atardecer/noche. Propuesta revisable y aplicación atómica con deshacer.
- Contexto IA: techo real, altura útil, huecos, muebles confirmados y zonas de paso.
- Moderno: propuesta de líneas sencillas, focos y colgantes según el uso.
  Mediterráneo: formas/materiales compatibles con el estilo y luz cálida.
  Son orientaciones estéticas, no una lista fija impuesta a todas las estancias.
- Anclar sobre mesa/isla solo si hay un objeto confirmado o zona marcada por el
  usuario. No depender del mobiliario importado pendiente de reconocimiento.
- La respuesta estructurada debe validarse antes de crear entidades persistidas.
- Generar prompts desde el mismo contexto del documento y usarlo en las rutas
  principal/compacta y fallback. No prometer que una instrucción textual garantice
  fidelidad geométrica del proveedor: comprobar imágenes con referencias.
- Modo estricto: reproducir luminarias aceptadas, sin nuevas adiciones. Modo
  controlado: propuesta de nuevas luces solo con la opción activada. Un cambio
  de techo se acepta como edición antes de pedir un render que lo represente.
- En cenital/isométrica de trabajo, ocultar el techo sin borrar luminarias. En
  vista interior, representar el acabado real; nunca interpretar la transparencia
  de edición como un material de cristal solicitado.

### 4. Validación de extremo a extremo

- Proyecto existente sin techo sigue abriendo sin alteración automática.
- Habitación rectangular y en L; patio abierto; planta superior/forjado existente.
- Mover paredes y cambiar altura conserva anclajes o avisa de conflictos.
- Guardar/recargar/deshacer conservan techo y luminarias; selección 2D/3D usable.
- Comparar estilo moderno/mediterráneo, día/noche, vista interior/cenital.
- Presupuesto limitado de pruebas IA en la implementación; pruebas geométricas
  locales antes de generar imágenes. Sin generación de pago en la planificación.

## Fuera de esta prioridad

Mobiliario importado: ver [incidencia](issue-mobiliario-importado.md).
Cubiertas inclinadas, techos de cristal como solución constructiva, geometrías
complejas de falso techo y cálculos eléctricos/fotométricos normativos.
Recorridos y vídeo IA siguen después de estabilizar la escena editable.

## Decisión de presentación

«Cristal transparente» se implementa como visualización durante edición. Un techo
realmente acristalado necesitaría una opción de material distinta y queda fuera.

## Validación y pendientes

- 232 pruebas en 38 archivos, TypeScript y build correctos según informe QA.
- ESLint de los 35 archivos de implementación revisados correcto; el lint global
  conserva 29 errores y 22 avisos previos, no se declara limpio.
- Navegador: habitación 6 × 4 m, falso techo de 15 cm (altura 2,55 m), propuesta
  de tres focos aceptada y guardado «Sincronizado». Vista 3D comprobada: techo y
  focos visibles. Exportación PNG y guardado en Diseños completados.
- Máximo 12 emisores 3D dirigidos hacia abajo, con sombras de 512 px por emisor;
  cuerpos válidos visibles. Corregidos halos superiores y relleno nocturno ajeno.
- Captura nativa corregida: descarga a resolución del canvas y copia persistida
  limitada a 2048 px de lado máximo, ambas del mismo fotograma.
- Recarga manual no ejecutada para no interferir con cambios nuevos observados
  en la pestaña; roundtrip y persistencia cubiertos por pruebas automatizadas.
- Plantillas del asistente: corregido el bloqueo por metadata y altura; las cinco
  plantillas convierten. Salón comedor activado y reabierto sincronizado en navegador.
- Color personalizado de emisión aplazado en [issue #42](https://github.com/yosnap/habiteka-app/issues/42).
- Mobiliario importado sigue aplazado en issue #41. Recorridos después de estabilizar
  la escena. No se han generado imágenes de pago para validar fidelidad externa.

