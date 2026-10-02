# Parcela real y promoción geográfica — 30/09/2026

## Implementado

- Panel «Parcela real»: coordenadas, copia de ortofoto IGN/PNOA, plano a escala métrica, giro horario con norte arriba y contorno de intervención.
- Guardado dentro del documento versionado: la ubicación entra en la huella de aprobación. Cambiar encaje o luz exige una revisión nueva. Se conserva al cambiar de planta.
- Escenarios separados: obra nueva, sustitución y reforma. No se confirma un encaje sin contorno válido. La reforma requiere definir qué elementos conserva antes de exportar sus etapas.
- Preset «Tarde» añadido a escena, capturas, imágenes, configuraciones reutilizables y aprobaciones.
- Entorno 3D sobre la ortofoto guardada, con escala y orientación del encaje.
- Promoción nativa de 30 s independiente de ruta interior: estado de la ortofoto, preparación, suelos/plataformas, estructura, huecos/cubiertas, acabados/mobiliario y vuelo final.
- MP4 a 1080p/30 fps, descargable y guardable en Vídeos, vinculado a aprobación, ubicación, escenario y luz. Sin consumo de generación IA.
- Pérgolas y cubiertas visibles durante la grabación; todas las plantas del edificio. La promoción espera los modelos 3D y rechaza los que han fallado antes de grabar su representación simplificada.
- Isométrica/dron usan la ortofoto del encaje confirmado; mantienen las referencias aceptadas de identidad y el rechazo de pérdida de elementos.
- Autorización de proyecto/organización para obtener y resolver la ortofoto; rechazo de claves de otro proyecto al activar o guardar el documento.

## Verificación

- Navegador local: el panel abre y carga la ortofoto de **[coordenada privada], [coordenada privada]**, de unos 180 m de ancho; el plano se superpone a escala.
- Confirmar sin contorno muestra el error esperado, sin guardar ni confirmar ubicación.
- 55 pruebas superadas en 8 archivos: proyección/inversa, giro, escala, polígonos cruzados, plantas, propiedad del archivo, aprobación, luz, modelos listos, guion, firma/subida/registro del vídeo y referencias de dron.
- Compilación de producción completada; tipos y ESLint de los módulos nuevos sin errores.
- Pruebas unitarias con el destino aislado exigido por el repositorio, sin escritura en la base de desarrollo.

## Límites y siguiente dato necesario

La ortofoto es una referencia plana. Su fecha de copia no es la fecha del vuelo. La preparación se representa con una superficie dentro del contorno; no es una reconstrucción 3D de la casa anterior ni una simulación técnica de demolición. Las etapas revelan componentes existentes del diseño, sin inventar cimentaciones.

El exportador produce una visualización conceptual 3D con rótulo explícito. El vídeo fotorrealista comparable a las referencias sigue pendiente de encaje confirmado, evaluación de imágenes/continuidad y presupuesto de generación.

El formulario quedó abierto para revisar el encaje. Al volver a abrirlo después de la compilación aparecía un encaje pendiente con coordenadas [coordenada privada], [coordenada privada] y giro -49°; esos valores no los fijó esta implementación y se conservaron. Esta ejecución no confirmó posición/orientación/acceso, no aprobó otra revisión y no generó/publicó un MP4 geográfico.

Antes de exportar el caso real: delimitar la construcción que se sustituye o la zona libre, comprobar orientación/acceso y elegir escenario/luz. Para reforma: indicar qué se conserva y qué se transforma.
