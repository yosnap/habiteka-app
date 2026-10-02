# Continuación del diseño — 30/09/2026

## Implementación

1. **Estancias y cobertura.** Cada render interior conserva ID, nombre, superficie y zonas contenidas, calculados en servidor contra el documento verificado. Para los renders antiguos se recupera la estancia de la revisión original mediante su cámara exacta; si no puede identificarse, no se etiqueta como inmueble completo. La selección del montaje conserva dormitorios distintos y excluye revisiones ajenas al diseño aprobado. La cobertura se calcula sobre las imágenes que realmente quedan seleccionadas.
2. **Tandas.** Los rechazos medidos de encuadre o fidelidad llevan un código específico y permiten continuar con las siguientes imágenes. Se conservan éxitos, índices y etiquetas; reintentar procesa solo pendientes. Una respuesta inválida del auditor o un fallo de servicio detiene el lote.
3. **Vistas lejanas.** La isométrica requiere una cenital previa y el dron una isométrica previa del mismo contenido, planta, luz, libertad, ámbito y permiso de rediseño. Se generan primero las referencias cercanas, incluso cuando «Vista actual» corresponde a una cámara lejana. La ortofoto se usa solo como entorno; para ámbitos aislados con máscara se conserva fondo neutro. La auditoría compara también la referencia y exige identidad arquitectónica completa: perder pérgolas, cubiertas o terrazas visibles provoca rechazo. Se guarda el ID del render de referencia.
4. **Fijos.** Casilla explícita para autorizar sustituciones de cocina, isla, sanitarios y armarios empotrados en las imágenes. Muros, huecos, instalaciones y accesos siguen protegidos. El permiso se guarda y Jev detecta conjuntos que mezclan permisos distintos. En propuestas editables, la casilla permite únicamente acabados verificables de fijos existentes, con revisión individual; no cambia su geometría.
5. **Solo la casa.** Atajo de máscara construido con las estancias interiores y sus fachadas de la planta activa; excluye parcela y patios. El ámbito editable conserva elementos exteriores. El prompt de tipo «Casa completa» conserva terreno y jardín sin rediseñarlos; la regla equivalente de `entrega.ts` ya estaba aplicada.
6. **Plantillas e instrucciones.** Configuraciones con nombre por organización en BD, disponibles entre inmuebles y navegadores: luz, libertad, categorías, ámbito transferible, vistas, tipo de espacio, estilo, objetivo e instrucciones. Permiten cargar toda la configuración o solo las instrucciones. Los IDs, coordenadas, selección de estancias y ortofoto se eligen en cada inmueble. Guardado con comparación optimista y conservación de otros metadatos de organización, sin migración.

## Verificación

- 108 pruebas pasadas en 17 archivos; después, 9 pruebas pasadas de referencias y preparación, incluidas cuatro comprobaciones nuevas de planta y orden de cámaras. Total del conjunto: 112 pruebas en 18 archivos.
- TypeScript sin errores; compilación de producción completada. ESLint sin errores, con un aviso preexistente de `<img>` en el diálogo. `git diff --check` limpio.
- UI de FInca: las ocho vistas interiores antiguas se recuperan y se distinguen por estancia y superficie. Selección sugerida: 12 imágenes del contenido aprobado. Salón y Cocina están cubiertos; siguen faltando Entrada y Patio.
- UI del diálogo: casilla de rediseño, plantillas de organización y ámbito Solo la casa visibles; el resumen de permisos distingue el ámbito y los fijos.
- Ningún archivo de código modificado supera 1000 líneas. Capturas, referencias, plantillas y acabados se han separado en módulos pequeños.

## Límites de esta verificación

No se han generado nuevas imágenes de pago ni nuevos clips. La exigencia de identidad completa se ha comprobado en contratos, referencias y auditoría con pruebas; queda validar una nueva isométrica/dron con el proveedor real. Las plantillas se han probado con repositorio simulado (organización, concurrencia, lectura, borrado y conservación de metadatos); la UI ha comprobado la lectura del repositorio real, sin guardar plantillas de prueba. Esto no cierra la película cinematográfica ni las fases 3–5 del plan integral. Los cambios están sin commit/push.
