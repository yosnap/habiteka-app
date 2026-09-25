# PRD — Inmueble verificable: del plano a la visita y al vídeo

**Estado:** borrador para decisión de producto · **Fecha:** 24-09-2026 · **Ámbito:** Habiteka, Estudio + Editor v2 + entregables. Este PRD complementa la [especificación general](./Especificacion_Proyecto_Reformas_e_Interiorismo_Inteligente.md) y gobierna el [plan de implementación](../plans/260924-1459-flujo-integral-plano-diseno-inmersion-video/plan.md), sin sustituir sus fases técnicas.

## 1. Decisión de producto

Construir una herramienta para transformar un inmueble real o proyectado en una **propuesta espacial revisada y presentable**: plano editable, diseño coherente, visita libre en primera persona y vídeo publicitario nacen de una misma versión aprobada. La IA acelera ideas y producción, pero no oculta diferencias entre una imagen sugerida, un objeto 3D y un artículo comercial real.

La diferenciación es una **hipótesis operativa de fidelidad y fluidez**, no la novedad de cada función. [Planner 5D](https://planner5d.com/business), [Homestyler](https://resources.homestyler.com/about/) y [Coohom](https://www.coohom.com/us) ya anuncian parte sustancial de este conjunto; [Matterport](https://matterport.com/industries/real-estate) domina la visita de inmuebles capturados. La [investigación competitiva](../plans/reports/competencia-producto-260924-1745-habiteka-valor-diferencial-report.md) delimita lo que debemos probar con usuarios.

## 2. Usuario y trabajo que necesita resolver

**Decisión del responsable de producto:** servir en paralelo a inmobiliarias/promotoras, interioristas/diseñadores y tiendas de muebles. Una sola plataforma y un mismo inmueble versionado, con entrada, entrega y métrica diferentes para cada sector. Si los recursos obligan a elegir un primer piloto comercial, empezar por **una mueblería**; hoy no hay socio confirmado y ello no debe bloquear el núcleo común ni las pruebas con los otros dos sectores.

| Sector | Trabajo principal | Entrega y acción valiosa |
|---|---|---|
| Inmobiliaria/promotora | Mostrar el potencial de un inmueble concreto a compradores. | Visita compartible y vídeo de comercialización desde diseño aprobado. |
| Interiorista/diseñador | Explorar alternativas con un cliente, corregir y obtener aprobación. | Diseño editable, comparaciones, revisión y propuesta trazable. |
| Tienda de muebles | Demostrar cómo queda un conjunto de productos propios en el espacio del cliente. | Estancia amueblada con SKU/variante, visita/vídeo y lista para presupuesto o compra. |

Usuarios transversales: operador que prepara/diseña, responsable que aprueba, destinatario que visita o ve el anuncio y, en la tienda, asesor comercial que convierte el proyecto en consulta o presupuesto.

> «Con el espacio real del cliente, quiero crear una propuesta que pueda corregir, aprobar, recorrer y compartir, mostrando qué productos y acabados son reales, para tomar una decisión o vender con confianza.»

Dolores detectados en el producto actual: estados confusos en el Estudio, «Editable (beta)» que no edita el plano importado, resultados guardados difíciles de localizar, imágenes IA que pueden no corresponder al 3D, catálogo persistente separado del Editor v2 y ausencia de visita libre. Son observaciones del código, no entrevistas de mercado.

## 3. Promesa y límites

**Promesa:** «Diseña una vez, revisa con confianza y presenta el mismo inmueble en plano, visita y vídeo». El sistema muestra procedencia, versión y grado de fidelidad de cada salida. La biblioteca propia da ideas y elementos colocables; una tienda piloto autorizada aporta artículos identificables y comprables. El enfoque multisectorial no requiere tres editores: requiere tres recorridos de entrega sobre el mismo modelo.

**Hipótesis diferencial intersectorial:** un inmueble preparado por una inmobiliaria puede servir de base a una propuesta de interiorismo y a una selección de muebles de una tienda, si sus titulares lo autorizan. Cada participante conserva contexto y trazabilidad sin rehacer el espacio. En el primer lanzamiento esto significa resultados compartibles con permisos y lista de productos; no presupone edición simultánea entre empresas ni una red de socios ya constituida. La calidad de ese traspaso debe compararse con el trabajo actual de cada sector.

**Límites:** no certifica medidas ni documentación de obra; no sustituye la revisión de un profesional competente; no reconstruye automáticamente un modelo 3D exacto desde una foto; no garantiza que un vídeo generativo conserve geometría o SKU. La visita de un proyecto diseñado no se presenta como captura fiel de la vivienda existente. No se asume que la afiliación produzca ingresos hasta medirla.

## 4. Experiencia de extremo a extremo

1. **Crear proyecto e importar:** imagen/PDF/boceto o documento existente. El Estudio muestra fuente, resultado, estado, coste de generación y siguiente acción. El error de importación PDF se corrige antes del piloto.
2. **Revisar plano:** comparar original, redibujado y geometría; corregir medidas, paredes, huecos y conexiones en el editor auténtico. Ninguna pestaña inactiva queda sin explicación.
3. **Diseñar:** seleccionar estilo, material propio o referencias de inspiración. La IA propone cambios aplicables al modelo editable; las imágenes de referencia no se hacen pasar por entidades 3D. El usuario cambia objetos y acabados manualmente.
4. **Comprobar y aprobar:** cobertura de vistas, estancias, circulación, materiales y objetos. Se señalan rincones no vistos y contradicciones. La aprobación fija documento y versiones de activos; los cambios posteriores crean otra revisión.
5. **Visitar:** recorrido libre con WASD/flechas y ratón; alternativa táctil/guiada. Puertas, escaleras, colisiones y límites del inmueble funcionan según el modelo aprobado. El visitante conoce si ve un diseño propuesto o un estado existente.
6. **Crear vídeo:** montaje visual del edificio, revelación exterior/interior y vuelo/paseo breve desde la misma revisión. Primero exportación 3D fiel; mejora generativa opcional por clips, sometida a revisión. Formatos horizontal y vertical; guardar y reabrir el entregable.
7. **Consultar productos:** lista de objetos usados con origen y nivel de exactitud visual. En la fase comercial, SKU/variante y enlace actual de tienda; precio y stock no quedan congelados dentro de la versión aprobada.

Durante estos pasos hay **un único chat del proyecto**. El usuario puede pedir «revisa las puertas», «cambia el acabado del salón» o «prueba este sofá» sin elegir manualmente un agente. El sistema indica qué capacidad actuará, propone un cambio concreto, enseña su efecto y permite aceptar o descartar. Un cambio sobre una versión aprobada crea un borrador nuevo; nunca modifica en silencio una visita o un vídeo publicados.

**Salidas por sector:** la inmobiliaria comparte visita y vídeo de anuncio; el interiorista comparte propuesta y comparaciones para aprobación; la tienda comparte estancia con productos, variantes y llamada a presupuesto/compra. Las tres salidas reutilizan la misma aprobación y pueden coexistir en un proyecto cuando sus permisos lo permitan.

## 5. Requisitos y prioridad de entrega

| Bloque | Requisito no negociable | Condición de salida |
|---|---|---|
| Estudio | Importación fiable, estados entendibles, galería de resultados y acceso al editor real. | El usuario sabe qué está viendo y cómo continuar sin ayuda. |
| Diseño | Catálogo único para objetos propios y propuesta IA; colocación con medidas; vistas comparables. | No se anuncia en 3D un elemento disponible solo como imagen. |
| Aprobación | Snapshot inmutable del inmueble y activos con avisos de inconsistencias. | Plano, visita y vídeo refieren la misma revisión. |
| Inmersión | Navegación libre por zonas conectadas, colisiones, controles accesibles y salida clara. | No se atraviesan sólidos ni aparecen estancias inconexas como transitables. |
| Vídeo | Construcción visual + recorrido nativo reproducible; variantes de encuadre. | Un clip IA se rechaza si altera distribución o SKU destacado. |
| Comercio piloto | Alta revisada de una mueblería, SKU/variante, derechos de uso y datos comerciales vigentes. | Producto exacto solo con activo 3D autorizado y validado; lista apta para consulta o presupuesto. |
| Asistente conversacional | Chat único que dirige revisión de plano, edición, decoración, acabados, catálogo y guion de vídeo a operaciones tipadas. | Se previsualiza el efecto, se comprueba la revisión y se puede deshacer; no hay agentes autónomos alterando el proyecto en paralelo. |

**Orden de construcción y validación:** construir una vez el circuito fiel de Estudio a diseño aprobado/visita/vídeo; en paralelo preparar un inmueble y tareas de prueba para cada sector e identificar una mueblería piloto. El material propio permite probar el flujo antes del acuerdo, pero nunca se etiqueta como catálogo de socio. La conexión técnica del primer catálogo autorizado comienza cuando exista contrato y la fase de catálogo común esté lista. Kie mejora clips después de comprobar el vídeo nativo, sin retrasar la prueba de valor de los tres sectores.

**Piloto de mueblería recomendado:** negocio local o regional dispuesto a designar un interlocutor, aportar una selección manejable de artículos con medidas/variantes/fotos y autorizar su uso. Empezar con alta revisada y solicitud de presupuesto o cita asociada al diseño; añadir sincronización masiva y carrito solo si el socio los necesita y facilita sus sistemas. Si no proporciona modelos 3D, mostrar aproximaciones declaradas y seleccionar algunos artículos para modelado/licencia antes de prometer exactitud de SKU.

## 6. Asistencia conversacional acordada

**Decisión:** especializar capacidades, no multiplicar agentes autónomos. El chat dirige la solicitud a un módulo de dominio. El revisor combina reglas geométricas y Jev para explicar incidencias; editor, decorador y acabados proponen operaciones sobre el documento; catálogo selecciona solo IDs elegibles; dirección de vídeo propone guion y cámaras cuando exista esa fase. «Constructor» significa montaje visual en vídeo o una modificación arquitectónica solicitada: en este segundo caso siempre se presenta el cambio y se exige aceptación explícita. Ninguna capacidad decide por sí sola permisos, medidas exactas, precio o publicación.

`Petición → clasificación acotada → propuesta tipada → validación de dominio/permisos/revisión → vista previa → aceptación → historial y nueva revisión`.

Jev se usa en puntos de control: intención ambigua, calidad de la extracción, salud del plano, coherencia de una instrucción antes de gastar y valoración de resultados sobre evidencia. **No** se llama en cada pulsación ni sustituye validaciones deterministas. Para juzgar imagen/vídeo necesita mediciones o un auditor visual previo; su puntuación no certifica por sí sola la fidelidad de los píxeles. Una respuesta incierta o una caída del evaluador no autoriza gastos ni cambios irreversibles automáticamente.

Cada turno recibe el estado mínimo: revisión y selección actuales, geometría de la zona afectada, preferencias confirmadas, un subconjunto elegible del catálogo, resumen persistido y pocos turnos recientes. Se fija un presupuesto de **tokens de entrada además del límite de salida**; las imágenes se adjuntan solo cuando la acción las necesita. Si el contexto no cabe, se pide acotar la zona o se resume sin eliminar cotas ni relaciones físicas. Se registra por operación proveedor, tokens, latencia, coste y resultado; el modelo de texto no decide qué motor de imagen/vídeo usar sin reglas de producto.

**Aceptación:** probar órdenes reales y adversariales de los tres sectores. Cero cambios no autorizados, cero SKU inventados o paredes atravesadas, ninguna propuesta basada en una revisión obsoleta aplicada, historial de deshacer funcional y coste/contexto medidos. Solo valorar varios agentes autónomos si una comparación con este enfoque muestra mejora clara de calidad o tiempo que compense latencia, coste y riesgo de conflictos.

## 7. Principios de experiencia diferencial

- **Una acción principal por estado:** preparar, corregir, diseñar, aprobar, visitar, publicar. La galería enseña procedencia y revisión, no una mezcla de miniaturas sin contexto.
- **Verdad visual explícita:** «modelo aprobado», «imagen de inspiración» y «representación aproximada» son estados visibles. Una toma atractiva no anula un error geométrico.
- **IA supervisada:** propone alternativas y explica cambios; el profesional decide. Un diseño aceptado no se modifica silenciosamente por nuevas generaciones.
- **Entrega reutilizable:** visita y vídeo tienen URL/archivo, versión, permisos y estado propios, pero reutilizan el mismo inmueble.
- **Comercio sin engaño:** los productos patrocinados o enlazados se identifican; SKU visual, disponibilidad y precio mantienen fuentes y tiempos separados.

## 8. Medición y decisión de lanzamiento

Instrumentar el embudo compartido `proyecto_creado → importación_válida → plano_corregido → diseño_aplicado → revisión_aprobada → visita_abierta → vídeo_exportado → enlace_compartido`, junto a tiempo, errores, coste IA/exportación y razones de abandono. Registrar el sector de cada proyecto y eventos propios: `anuncio_publicado` para inmobiliaria, `propuesta_aceptada` para interiorismo, `producto_visto → consulta_o_presupuesto` para tienda. Un clic de salida no equivale a una venta.

**Pilotos paralelos propuestos, umbrales iniciales a confirmar:** un inmueble y al menos dos profesionales por sector para pruebas guiadas, más un caso de dos plantas para conexiones. En tienda, un socio real y un conjunto pequeño de SKU licenciados cuando se firme el acuerdo; hasta entonces, probar la mecánica con material propio sin simular pedidos. Objetivo transversal: que la mayoría complete su tarea principal sin intervención, que los destinatarios consideren compartible el resultado y que haya cero fallos críticos de distribución, puerta o SKU declarado exacto. Medir por separado: tiempo hasta anuncio publicable, tiempo hasta propuesta aprobada y tiempo hasta consulta/presupuesto trazable. Son criterios de decisión propuestos, **no datos de mercado**.

La decisión de escalar se toma por sector, no por promedio global: exigir interés de pago explícito y proceso repetible en cada uno. El primer acuerdo de mueblería valida la integración comercial, pero no demuestra por sí solo valor para inmobiliarias o interioristas. Comparar al menos un caso representativo contra dos alternativas con la misma entrada antes de afirmar superioridad.

Calcular coste variable por proyecto aprobado y por vídeo, tasa de exportaciones válidas, soporte necesario y margen con un precio probado. No fijar créditos/precio definitivo a partir de estimaciones. Si falla la confianza espacial, detener embellecimiento de vídeo y corregir el modelo. Si hay calidad pero bajo interés de pago, revisar segmento/paquete antes de ampliar catálogo.

## 9. Riesgos y dependencias

- Requiere un inmueble de referencia, medidas contrastadas y revisión humana de diseño para evaluar fidelidad. El resultado no es documentación arquitectónica certificada.
- Fotos y planos pueden revelar datos de personas y domicilios: revisar permisos, privacidad, retención y proveedores antes de compartir públicamente; no asumir cobertura legal por tener una cuenta de usuario.
- El rendimiento web y el coste de vídeo se miden en dispositivos y proyectos representativos. No cambiar a un motor pesado sin evidencia de que Three/R3F no cumple.
- Los acuerdos con tiendas deben cubrir feed, licencias de imágenes/modelos, actualización y atribución. No incorporar inventario de terceros sin autorización. Como aún no hay contacto, la captación del primer socio es un riesgo externo y se gestiona en paralelo, sin fingir que el catálogo comercial ya existe.
- Un vídeo externo puede ser muy bueno estéticamente y falso espacialmente; la versión nativa queda como referencia y salida disponible.

## 10. Decisiones pendientes del responsable de producto

1. Identificar una mueblería candidata y su interlocutor para el piloto; acordar permisos de catálogo y condiciones antes de cargar sus productos. Elegir un inmueble representativo por sector y revisores de fidelidad, utilidad y disposición a pagar.
2. Confirmar con la tienda si la primera conversión será solicitud de presupuesto/cita (recomendación inicial) o salida al carrito; condiciona datos e integración, pero no el modelo espacial común.
3. Decidir si la primera visita se comparte externamente o solo dentro del equipo; afecta permisos y publicación.
4. Definir presupuesto máximo por vídeo después de medir Kie y exportación nativa; ninguna mejora IA se activa sin coste visible.

La implementación queda descrita por fases en el plan enlazado. Antes de ejecutar una fase, comprobar que conserva esta promesa, sus límites y los criterios del piloto.
