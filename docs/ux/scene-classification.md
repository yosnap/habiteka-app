# Escena: clasificación y captura de trabajo

Escena mantiene acciones de navegación, nombre y visibilidad. El doble clic abre el inspector existente. Los atajos Alt/Option+1/2/3 se declaran en `editor-shortcuts.ts` y se resuelven en el shell, respetando campos de texto, atajos desactivados y tareas de construcción activas.

## Persistencia y precedencia

- `FloorFinish.classification` guarda Interior/Exterior por identidad de estancia; ausencia significa Automático. Reutiliza la persistencia, copia por planta y deshacer del documento, sin nueva tabla SQL.
- `DesignZone.classification` guarda la misma elección para una zona. La validación estricta admite ambos campos opcionales, sin invalidar documentos anteriores.
- La elección de la estancia prevalece. Una zona explícita solo se hereda cuando su intersección cubre toda la estancia (tolerancia de 1 mm²); las zonas parciales no reclasifican habitaciones completas.
- Automático conserva los criterios previos de nombres, límites lógicos y ámbito exterior global.
- `eligibleCeilingRooms` usa esta resolución. Sus consumidores de cubierta, cámaras, ámbito de diseño y grupos de acabados reciben el mismo criterio. Exterior excluye el techo de la representación sin borrar su configuración; volver a Automático/Interior permite recuperarlo. No se crean cubiertas al cambiar el tipo.
- Cambiar acabados conserva la clasificación mediante las operaciones existentes de suelo. Si se elimina la estancia, su metadato deja de aplicar igual que sus acabados.

## Captura

La captura de trabajo compone los lienzos Konva visibles o copia el lienzo WebGL actual, con máximo de 2400 píxeles en su lado mayor antes del pie. Añade una marca de referencia del plano guía y descarga PNG. No cambia cámara, geometría, visibilidad ni diseños aceptados. No llama a proveedores ni guarda un entregable final. Las etiquetas HTML superpuestas al 3D y los menús no forman parte de la imagen. El flujo de referencias para generación permanece independiente y conserva sus garantías de arquitectura.
