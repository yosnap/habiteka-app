# Fidelidad de diseños y continuidad entre vistas

## Alcance autorizado

Revisar resultados existentes, corregir generación/evaluación y verificar interiores,
zonas, laterales y exterior para preparar vídeos. Un agente. Preservar cambios
previos. Sin aceptación de imágenes, commit, push ni despliegue.
Pruebas IA: cuatro imágenes inicialmente, ampliadas explícitamente a seis con
revisión, máximo total 5 USD autorizado. Las seis ya se han generado.

## Hallazgos reproducidos

- Interiores sin referencia obligatoria al diseño aceptado; no se auditaba esa continuidad.
- Acabados/fijos del editor compiten con los de la referencia aceptada.
- Dron/isométrica recibían texto que llamaba cenital girada a otra perspectiva.
- Alzados cerrados podían convertirse en sección abierta por elegir un lateral.
- Normalización de «no visible» podía borrar fallos explícitos de huecos, exterior y sanitarios.
- Una estancia interior o de cenital completa podía desaparecer con «no visible».

## Verificación

- [x] Inspección del proyecto e imágenes existentes (datos privados fuera de documentación pública).
- [x] Reproducir selección de referencias e instrucciones contradictorias en tests.
- [x] Corregir contratos y referencias sin modificar el plano ni aceptaciones.
- [x] Pruebas locales y cuatro pruebas visuales como máximo, con control de gasto.
- [x] Documentación de usuario/técnica, docs:updates, docs:build, tipos/lint y revisión del diff.
- [x] Dos pruebas adicionales autorizadas y diagnóstico de los falsos descartes.
- [x] Resolver la comparación del subconjunto visible del salón, sin certificar piezas ocultas.
- [ ] Probar exterior cuando exista la ortofoto necesaria.

## Evidencia de las pruebas reales

- Dormitorio: la imagen copió el textil azul de la maqueta frente al verde de la
  cenital aceptada; la nueva revisión general la descartó.
- Salón inicial: la revisión general aprobó sillas y taburetes diferentes. Una
  segunda comparación sin maqueta identificó respaldos de listones y taburetes
  negros sin respaldo; su informe quedó corregido como descarte automático.
- Lateral izquierdo: geometría y mobiliario principal semejantes, pero añadió
  plantas en dormitorios. La comparación independiente corrigió otro aprobado
  general y lo dejó descartado.
- Exterior terminado: bloqueo comprobado por ausencia de ortofoto, antes de llamar
  al generador. No se usó una captura 3D como resultado alternativo.
- Repetición del salón con lectura previa y guía gris: mejora sillas y materiales,
  pero conserva cuatro taburetes sin respaldo. La lectura previa y la auditoría
  habían contado mal la referencia. Las ampliaciones recuperan ocho sillas y seis
  taburetes (tres por lado, con respaldo) y detectan el cambio en la candidata.
  La corrección final de lectura se verificó con visión real, pero todavía no con
  otra generación: se alcanzaron las cuatro imágenes autorizadas.

Validación local: 423 tests en 55 archivos, typecheck, eslint de archivos afectados,
docs:updates, docs:build y diff --check correctos. Se ajustó una expectativa antigua
de versión v5 en un test de retoque, porque el cambio previo ya usa v6.
Las imágenes privadas y respuestas detalladas están fuera del repositorio.

Estado al terminar la tanda autorizada: cuatro imágenes generadas, todas descartadas
tras contrastarlas; ninguna aceptación creada. Coste registrado de imágenes y visión:
0,51548675 USD, sin costes desconocidos. El plano conserva la revisión 61.
Tras la última corrección: 76 regresiones específicas, typecheck, eslint,
docs:updates y docs:build correctos. La galería muestra el descarte y bloquea aceptar
la última candidata. Se solicita ampliar en dos imágenes (salón y dormitorio) el
máximo de cuatro, manteniendo el presupuesto total de 5 USD. Autorización adicional
recibida el 7 de octubre a las 16:04: dos imágenes más (salón y dormitorio), total
máximo seis imágenes y 5 USD. No aceptar diseños por el usuario.

## Resultado de las dos imágenes adicionales

- Dormitorio: recupera textil verde y mesillas redondas del diseño aceptado;
  supera las revisiones y queda pendiente de aceptación del usuario.
- Salón: conserva ocho sillas y tres taburetes visibles con respaldo. El auditor
  contaba cuatro taburetes al comparar, duplicando parte de una pieza. Las
  ampliaciones por sí solas no resolvieron el error. Una lectura aislada de la
  candidata recupera el recuento correcto; se integra antes de la comparación.
- La comparación sigue interpretando como ausentes los asientos del lado oculto
  de la barra. No hay evidencia suficiente para confirmar ausencia ni conservación:
  se guarda la candidata con revisión incompleta y aceptación bloqueada. El informe
  anterior queda conservado en evidencia privada, sin aceptar ni sustituir imágenes.
- Control de regresión visual: la repetición anterior del salón sigue descartada
  por cuatro taburetes sin respaldo frente a la referencia aceptada.

Coste final registrado: **0,9081435 USD**, seis imágenes y 32 llamadas de visión,
sin costes desconocidos. Ninguna aceptación creada. Se trabajó en una pestaña
separada sobre la revisión guardada; el borrador abierto por el usuario se preservó.
No se generaron vídeos. La tanda cierra con un dormitorio revisado, cuatro imágenes
descartadas por incoherencias y un salón sin verificación completa. No se declara
resuelta la fidelidad total del proyecto ni validado un recorrido entre estancias.

Verificación final: la suite relevante ejecutó 425 pruebas; 424 pasaron y una
expectativa quedó anticuada al añadir la lectura aislada. Corregida para verificar
las tres fases, la repetición específica pasó 56 pruebas en cuatro archivos,
incluyendo cuatro casos nuevos de lectura incompleta y separación de referencias.

## Continuación: desbloqueo y preparación de primera persona

- El usuario aceptó el dormitorio en la aplicación; aceptación comprobada el 7 de
  octubre a las 17:38. No se aceptó el salón en su nombre.
- Revisión v13: primero declara oclusiones y después compara subconjuntos visibles.
  El salón nuevo supera esta comparación; el control anterior con cuatro taburetes
  sin respaldo sigue rechazado. Se actualizó solo su revisión de identidad,
  conservando los controles geométricos originales y sus fechas. Queda pendiente
  de aceptación, sin certificar los objetos que no pueden observarse.
- No se generaron imágenes nuevas. Coste acumulado tras las dos comprobaciones:
  0,969927 USD.
- La edición posterior del proyecto pasó a revisión 62; se detectó también su nueva
  aprobación durante el trabajo. No se alteró ninguna de esas versiones.
- Primera persona permite elegir una aprobación histórica de origen y conserva la
  luz de las imágenes aceptadas, en vez de imponer la luz de la maqueta. Las
  referencias siguen verificadas contra esa revisión al preparar y enviar. El
  borrador posterior no se incorpora. Construcción conserva el requisito vigente.
- Se prepara una toma del dormitorio aceptado, revisión 61, luz de día, 8 segundos,
  768P, sin generar ni transferir referencias hasta autorizar el vídeo concreto.
- Preparación guardada y comprobada en la aplicación: una referencia, movimiento
  corto sin revelar zonas ocultas, sin personas ni audio; presupuesto 0,32 USD.
  Se solicitó autorización de ese único vídeo, pero la corrección de alcance del
  usuario deja esa solicitud sin efecto: no generar esta toma aislada.
- Validación de la continuación: 101 tests en siete archivos, typecheck, eslint,
  docs:updates, docs:build y diff --check correctos. La selección de aprobación
  histórica se verificó en navegador y la preparación pudo guardarse sin cambiar
  el plano ni generar vídeo.

## Límite de producto

La primera persona implementada es una toma dentro de una estancia. No existe aún
un trayecto verificado entre habitaciones. Las pruebas no certificarán un recorrido
completo ni sustituirán la aceptación explícita del usuario.

## Corrección de alcance: recorrido de todo el inmueble

El objetivo confirmado es un único vídeo en primera persona que comienza fuera,
cruza la entrada real y visita todas las zonas conservando continuidad espacial
y visual. Las pruebas por habitación sirven como diagnóstico de identidad, pero
no son el entregable ni validan las transiciones. No seguir gastando en el piloto
del dormitorio. Su preparación permanece sin generar.

Hallazgos de la revisión del flujo completo:

- `designVisitSelectionIssue` exige una sola estancia y `designVisitPrompt` pide
  permanecer en ella. El trabajo de vídeo no contiene una ruta; el adaptador H3
  recibe imágenes, texto y duración, sin puntos de paso ni controles de transición.
- El editor sí calcula trayectos geométricos, colisiones y cámaras. Son guías,
  no el vídeo final. La ruta automática comienza en la estancia más grande,
  no en el exterior; su modalidad `bestEffort` puede omitir estancias inaccesibles.
  No sirve para certificar que se ha visitado todo el inmueble.
- La navegación bloquea puntos sin soporte reconocido de estancia, rampa,
  escalera o porche. Hace falta resolver el acceso exterior transitable, sin
  desactivar las colisiones ni considerar caminable cualquier punto de la parcela.
- El proyecto no tiene una ruta guardada en la revisión actual. Sus referencias
  aceptadas incluyen interiores con distintas luces y vistas generales, pero no
  una secuencia validada exterior → entrada → pasos entre todas las zonas.
- Prueba local sin guardar en revisión 62: `autoTour(..., {bestEffort: true})`
  devuelve 11 de 15 zonas, empieza en sala/comedor y dura 93,05 segundos. Omite
  un baño, patio interior, estudio y un paso sin etiqueta. `buildWalkthrough`
  informa cero tramos bloqueados: ausencia de colisiones no implica cobertura.
- Las imágenes asociadas a puntos del editor todavía no se enlazan con la
  generación del vídeo. La galería de storyboard no acredita por sí sola
  aceptación, compatibilidad ni continuidad entre dos cámaras.

Orden de implementación y validación necesario:

1. Trayecto con inicio exterior y entrada identificada, listado completo de zonas
   y pasos reales; informar cada zona no alcanzada. No guardar una ruta parcial
   bajo una afirmación de cobertura completa.
2. Referencias del mismo diseño vinculadas a cámaras de la ruta, incluyendo ambos
   lados de accesos, giros y zonas que aparecen al avanzar. Mantener aceptación
   explícita y coherencia de iluminación, arquitectura y mobiliario.
3. Generación por tramos del recorrido con control de los encuadres de unión.
   Verificar primero las capacidades reales del proveedor; concatenar clips
   independientes o escribir un prompt no acredita continuidad.
4. Revisión temporal de cada tramo y cada unión, cobertura final de todas las
   zonas y exportación de un solo vídeo. Mantener bloqueadas las transiciones
   sin referencias suficientes o sin implementación.

Pendiente: implementar y demostrar este flujo completo. Las pruebas de identidad
y la preparación del piloto anteriores no permiten declararlo terminado.

## Preparación del paseo detallado implementada

- Primera persona abre ahora `PropertyVisitPanel`: aprobación de origen, luz,
  elección explícita del acceso, mapa de cobertura, listado de todas las zonas,
  duración del trazado y encuadres con/sin referencia coincidente. No guarda el
  plano, acepta imágenes, reserva créditos ni contacta con proveedores.
- Entradas derivadas de puertas reales; se distingue origen exterior/patio.
  Puertas cerradas y suelo sin soporte siguen bloqueados con explicación.
- Búsqueda compartida de caminos sustituye múltiples búsquedas fallidas por zona
  en esta preparación. Mantiene todas las zonas, incluidas las de otras plantas
  (su enlace sigue pendiente), y comprueba cada segmento con la navegación real.
- Cámara a altura de ojos con desplazamientos cortos, giros y pausas de detalle.
  La duración crece con la visita. No se afirma cobertura visual por el hecho de
  que el trazado atraviese una zona, ni compatibilidad del mobiliario aceptado por
  comprobar únicamente los sólidos del plano.
- Coincidencias de referencias: aceptación y revisión resueltas por el servidor,
  cámara/planta/luz, sin recortes y altura de ojos. No certifican continuidad.
- La guía por todas las zonas del editor pasa a modo estricto: si no puede
  enlazarlas, no guarda una guía parcial bajo una promesa de cobertura completa.
- Prueba real de lectura: entrada principal identificada como puerta 28 en la
  interfaz, cerrada en revisiones 61/62. Entrada alternativa desde zona exterior
  del plano reproduce las cuatro zonas pendientes, sin guardar esa alternativa
  ni elegirla como entrada principal por el usuario.
- Comprobado en navegador: elegir revisión 61 recupera dos vistas aceptadas de
  día; seleccionar acceso 28 informa de puerta cerrada. Captura privada:
  `/tmp/habiteka-paseo-completo-preparacion.jpg`.
- Validación: 56 tests en seis archivos, más nueva regresión de giro corto que
  eleva a 57 los casos relevantes; typecheck y eslint correctos, docs:updates y
  docs:build correctos. El plano y las aceptaciones no se modificaron.

**El objetivo completo sigue pendiente.** Esta entrega implementa la preparación
y elimina el desvío al piloto de una estancia. Persistencia, generación de
referencias por encuadre, generación enlazada, revisión temporal y exportación
no están implementadas. No se generó vídeo ni se inició más gasto.

## Continuación 07/10, 20:00–20:20: canalización y límite económico

Implementadas persistencia de paseo, generación de encuadres desde cenital y
exterior aceptados, aceptación explícita, generación H3 con extremos compartidos,
revisión humana de tramos/uniones y composición/exportación MP4. Copia de puertas
abiertas, apoyo real en umbrales, búsqueda afinada a 75 mm y A* entre destinos.
Una regresión de rampas detectada en la suite se corrigió dando prioridad a sus
superficies reales frente al puente del umbral; los tests de navegación pasan.

Preparación real guardada desde revisión 61: 15/15 zonas, 25:44, 304 imágenes únicas
y 386 tramos. Precio calculado: imágenes 45,60 USD más visión; vídeo 61,76 USD.
**Este planteamiento se sobredimensionó y no es viable para el usuario.** No se
generaron esas imágenes ni vídeos; gasto adicional de esta continuación: cero.

El usuario confirma máximo **2 EUR por vídeo completo**, no por fragmento. Se
bloquea el envío desde servidor e interfaz si el conjunto de tramos/reintentos
supera el techo (cambio BCE reciente, reserva 30 %). Tampoco iniciar nuevas
referencias para un paseo ya fuera de presupuesto. No pedir ampliar presupuesto.

Revisión económica con fuentes primarias: H3 KIE 0,04 USD/s a 768P; Hailuo 2.3
Standard KIE 0,15 USD/6s y 0,26 USD/10s; LTX 0.9.7 fal 0,04 USD/s; LTX2.3 distilled
fal 0,001205 USD/MP de vídeo; Grok KIE 480p 0,012 USD/s. GPT Image no genera vídeo
(ficha oficial OpenAI). Precios bajos por clip no acreditan paseo completo ni
continuidad. No se contrató ni configuró ningún proveedor adicional.

La prueba del navegador comprobó capturas de varias zonas y detectó un aspecto
demasiado ancho; se corrigió a 16:9 con validación servidor/cliente. La tanda de
304 capturas no se terminó debido a cambios de implementación y presupuesto.
No se certifica ningún resultado hiperrealista, continuidad ni paseo completo.

Pendiente: replantear recorrido/modelo para respetar 2 EUR manteniendo todas las
zonas y el detalle pedido; referencias nuevas requerirán autorización de imagen
y aceptación explícita. No sustituir por montaje, recorrido 3D o visita parcial.
La autorización anterior de seis imágenes sigue agotada, con 0,969927 USD acumulados.

Verificación de esta continuación: 169 pruebas de navegación y vídeo existente,
42 del nuevo flujo y adaptador; tras añadir el presupuesto, nueve pruebas de
presupuesto/envío (cinco nuevas, cuatro repetidas) correctas. Typecheck, ESLint,
docs:updates, docs:build y diff --check correctos. Navegador comprobado: el paseo
guardado muestra sus diseños aceptados y el aviso de máximo 2 EUR, sin iniciar
gasto. BCE consultado en servidor: cambio 07/10/2026, 1 EUR = 1,1177 USD.
El objetivo del vídeo completo sigue pendiente; no afirmar entrega terminada.

## Continuación 07/10/2026 20:37 — un minuto y piezas separadas

El usuario fija recorrido de hasta 60 segundos; construcción en otro vídeo
independiente, también hasta un minuto. Se conserva el máximo de 2 EUR por vídeo.
Implementado paseo rápido: ruta geométrica completa separada de los clips de pago,
sin cuatro orientaciones por estancia ni cuatro segundos facturados por giro.
Los pasos intermedios permanecen en el mapa y en cada segmento; no se recorta el
final de la ruta para encajar en el minuto. Cobertura del trazado no acredita que
el generador muestre bien todas las zonas: la revisión enumera las de cada tramo.

Proveedor nuevo para estos trabajos: KIE `hailuo/02-image-to-video-standard`,
768P, clips de 6 segundos con primera y última imagen aceptadas, sin optimizador
de prompt ni cambio automático de modelo. Precio oficial verificado en la web
de KIE seleccionando Standard: 0,025 USD/s. Trabajos antiguos mantienen H3.
Límite de 60 segundos en generación y exportación; construcción aplica el límite
de duración y presupuesto por separado antes de reserva, traducción o subida.

Nueva preparación guardada por interfaz sobre los diseños de la revisión 61:
15/15 zonas, 60 segundos, 10 clips, 11 encuadres únicos. Vídeo 1,50 USD,
1,75 EUR con cambio BCE y reserva del 30 %. Nuevas imágenes 1,65 USD más visión.
Prueba real en navegador: 11/11 capturas guía válidas, 16:9, cámara/luz/cubierta
correctas. No se han generado ni aceptado imágenes ni vídeos en esta continuación.

Validación: 78 pruebas en 13 archivos correctas; TypeScript y ESLint correctos;
docs:updates, docs:build (18 páginas, sin errores/avisos) y diff --check correctos.
Guía de usuario, novedades y documentación técnica actualizadas con los límites
y la separación de las modalidades. Sin commit, push ni despliegue.

Se solicita autorización específica para 11 nuevas imágenes, máximo adicional
3 USD incluyendo análisis. La autorización anterior de seis está agotada; no se
inicia gasto mientras falte respuesta. El gasto de imágenes se explica separado
del vídeo. Después, el usuario debe aceptar las imágenes antes de los clips;
ninguna prueba local sustituye esa aceptación ni valida hiperrealismo del vídeo.

20:37: autorización explícita recibida para 11 imágenes hasta 3 USD incluidos
análisis. Usuario puntualiza enseguida que se prueben de una en una (~0,15 USD),
revisando y corrigiendo antes de avanzar; no quiere gastar el techo de golpe.
Se ha enviado únicamente `image-1`, exterior de entrada, del nuevo paseo
`1b9168a2-3ece-4053-b7d8-765e8683649b`. Las otras diez siguen pendientes.
Sin aceptación automática ni vídeo enviado. Coste registrado durante la revisión
de la primera imagen: 0,08810825 USD (imagen confirmada 0,08; análisis previo
0,00810825), todavía pendiente de terminar la revisión y sumar sus costes.

20:40: primera imagen terminada, total confirmado 0,13780175 USD. Descartada;
revisión visual propia detecta mesa oscura frente a la mesa clara de la cenital.
El auditor se detuvo antes de la comparación independiente por una contradicción
de visibilidad del árbol exterior. No se ha eliminado el descarte ni aceptado.
Causa: `renderRoomContext` solo reconoce cámaras fotográficas predefinidas, no
las cámaras intermedias del paseo. Por ello no se activaban lectura del mobiliario
aceptado, guía gris ni auditoría interior para la entrada.

Corregido con `property-visit-room-context`, que identifica habitación desde
posición/punto de mira con paso geométrico libre. No atraviesa puertas cerradas
ni paredes para asignarla. Los recintos sin etiqueta conservan contorno y nombre
neutro para localizarlos. 50 pruebas relevantes correctas tras corregir una
fixture cuyo porche tenía por defecto 80 cm de altura; typecheck y ESLint pasan.
Docs actualizadas y compiladas. Segundo intento de la misma entrada enviado
individualmente, conservando el primero. No se ha enviado ninguna otra cámara.

21:11: segundo intento corrigió la mesa pero recibió un aprobado automático pese
a diferencias visibles en textiles y un brazo marrón añadido al sofá. Se marcó
descartado por inspección visual, preservando su auditoría original. Se reforzó
la lectura separada de cojines, brazos y tapicería. Tercer intento de la misma
entrada conservó la mesa clara y eliminó ese brazo contrastante, pero el auditor
lo rechazó por cocina fuera del encuadre: combinaba null para fregadero/placa
ocultos con ceros correctos para tipos inexistentes. El validador exigía todos null.

Corregido ese caso sin perdonar fallos explícitos, desaparición de piezas visibles
ni ocultaciones en una cenital completa. Añadida reauditoría del encuadre guardado
con nueva captura de la misma cámara, sin generador de imágenes ni vídeo. Conserva
historial, versiones y aceptación manual; no reabre descartes visuales.

Prueba real desde la UI: tercer candidato `6718f605-cc36-49be-979d-932ff2a91aa9`
reanalisado y guardado con fidelity passed, versión 2, un informe anterior y sin
aceptación. Esto no garantiza fidelidad completa: el usuario debe revisar la imagen.
Total confirmado de esta autorización: 0,44565525 USD (3 imágenes de entrada y
sus análisis, incluida la reauditoría de 0,04846350 USD). Diez encuadres pendientes,
ningún vídeo enviado. Quedan ocho intentos de imagen de los once autorizados;
el techo de 3 USD no obliga a gastarlos. No se continúa la tanda hasta revisar esta
primera muestra conforme a la preferencia de probar poco a poco.

Validación adicional: 23 pruebas específicas (22 iniciales y una nueva de bloqueo
de revisión simultánea), TypeScript y ESLint correctos, docs:updates y docs:build
correctos (18 páginas, cero errores/avisos), diff --check limpio. UI deja visible
la imagen pendiente y el presupuesto del vídeo 1,75 € con margen, máximo 2 €.
Captura local privada: `/tmp/habiteka-entrada-revisada.jpg`; candidato:
`/tmp/habiteka-visit-entry-textiles.png`. Sin commit, push ni despliegue.

08/10 00:29: continuación individual del patio tras «sí» del usuario. Dos intentos
de la misma cámara; ninguno válido. Primer falso aprobado por cama en el estudio
y lucernario omitido; marcado descarte visual preservando auditoría. Añadidos
usos conectados por hueco, huellas de vidrio y referencia exterior en comparación
independiente con `architectureCheck` obligatorio. Segundo resultado pierde la
cama errónea pero sigue omitiendo vidrio y cambia la fuente; auditor general lo
rechaza antes de identidad. No se ha aceptado ninguna imagen ni enviado clips.
Acumulado nueva autorización: 0,69947425 USD, cinco intentos de once (3 entrada,
2 patio). Reporte y pendientes:
`plans/reports/fidelidad-patio-261008-0013-prueba-individual-report.md`.

08/10 01:31: cinco pruebas individuales más del patio. Guía sin muebles y vidrio
visible, recorte aceptado, posición/tipo/conexión/profundidad de huecos y corrección
dirigida implementados. Recuperan fuente, vegetación, estudio y lucernario, pero
la corredera sigue mostrando fondo y muebles inventados. No se considera resuelto.
La auditoría conjunta también confundía objetos candidatos con la referencia;
nueva comprobación aislada con descripción inmutable detecta ese fallo sobre la
imagen existente. Descarte conservado con historial. Coste adicional acumulado:
1,39885550 USD, 10 de 11 imágenes autorizadas. Último intento sin consumir;
0 clips enviados y 0 encuadres nuevos aceptados. Informe:
`plans/reports/fidelidad-patio-261008-0035-guia-arquitectonica-report.md`.

08/10 03:35: retoque regional implementado y probado desde UI. Último intento
autorizado corrige la galería del patio conservando 2.300.928 píxeles exteriores
sin un solo cambio. Nueva lectura de oclusiones resuelve falsos rechazos de altura
vegetal y mobiliario oculto tras puertas; reauditoría pasa y conserva historial.
Patio y entrada pendientes de aceptación humana; nueve encuadres aún sin generar.
Coste final de esta autorización 1,62178000 USD, once imágenes; ningún vídeo nuevo.
Para continuar imágenes hay que ampliar cantidad autorizada, manteniendo límite.
Reporte: `plans/reports/retoque-paseo-261008-0319-fondo-corredera-report.md`.
