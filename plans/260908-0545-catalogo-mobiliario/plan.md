# Catálogo de mobiliario semántico

## Alcance aceptado

Catálogo inicial de al menos 40 elementos esenciales, organizado por estancias,
con búsqueda, filtros y variantes configurables. Medidas físicas, representación
2D/3D coherente y contexto que la IA pueda interpretar. No generación remota,
consumo de créditos, importación de assets privados ni cambios del editor legacy.

## Evidencia y contrato

Next/React/TypeScript, Konva y Three existentes. Editor v2 vive en worktree
feat/editor-v2. Furniture permite kind string y catalogId estable; altura,
elevación y color ya son persistentes. No hace falta modificar el esquema.
furnitureVolumes alimenta colisiones y escena; conservar salida histórica para
objetos anteriores. La generación actual usa CanvasDoc legacy y autoridad
separada: no conectarla por conversión destructiva.

## Plan revisado

1. Registro exclusivo v2 con identidad, estancia, función, material, estilo,
   dimensiones, elevación y perfil geométrico. Variantes persistidas por catalogId.
2. Catálogo con filtros y miniaturas procedurales; inserción compatible mediante
   los comandos existentes y restricciones espaciales.
3. Perfiles compuestos reconocibles y compartidos por vista 2D, 3D y colisiones.
4. Contexto estructurado de objetos colocados por planta, medidas y posición
   actuales; panel accesible para consultar/copiar, sin generación simulada.
5. Pruebas, revisión independiente y comprobación visual en Comet.

## Aceptación

- Al menos 40 entradas en todas las estancias acordadas; búsqueda sin tildes.
- Variantes conservan identidad, medidas y aspecto al guardar/leer y deshacer.
- Cada perfil tiene geometría finita contenida en sus dimensiones, sin sustituir
  todo por la misma caja. Reutilización de volúmenes en render y colisión.
- Contexto IA contiene datos reales, planta, función y acabado de cada objeto;
  desconocidos conservan identidad sin inventar características.
- No regresiones en documentos históricos, readonly ni comportamiento legacy.
- Sin nuevas dependencias, commit ni push durante esta implementación.

## Límites declarados

Modelos procedurales editables, no catálogo comercial fotorealista. Objetos de
pared/techo se posponen si no existe anclaje válido; cortinas independientes y
lámparas con elevación explícita no deben fingir vinculación a una pared.

## Integración GLB aprobada tras inventario

Reutilizar 29 modelos locales auditados (hashes correctos, 2,255 MiB totales),
sin nuevas descargas. Registro con procedencia/atribución y tipo de modelo;
entradas reconocidas por ID, nunca URLs arbitrarias recibidas del documento.
Los assets etiquetados como aproximación en el manifiesto deben indicarlo.
Normalizar origen/frente y dimensiones en metros, clonar materiales por instancia,
mantener selección por ID y soportar plantas activas/inactivas. Fallo de un modelo
no debe tumbar la escena: aviso explícito y geometría simplificada de respaldo.
Colisiones mantienen sus volúmenes simplificados; no se promete precisión por
triángulo del GLB. Pintura como tinte, conservando textura y material de origen;
selección no sustituye el material por verde. La licencia del sofá exige créditos.
Validar caja final, identidad, colores independientes, lectura histórica y Comet.
