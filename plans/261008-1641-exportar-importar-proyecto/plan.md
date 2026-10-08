# Exportar e importar un proyecto (`.habiteka`)

Estado: publicado en v0.6.0 · 08/10/2026

## Resultado
Llevar un proyecto completo de una instalación a otra (local → producción) o a otra cuenta: **Exportar proyecto** descarga un `.habiteka`; **Importar proyecto** lo sube y crea un proyecto nuevo idéntico en la organización de quien importa.

## Contenido
- Proyecto (título, `studioState`), zonas, `canvas_state` (planos antiguos).
- Editor: estados, todas sus revisiones y aprobaciones.
- Entregables (diseños, vídeos…), imágenes de origen e iteraciones, sin los borrados.
- Archivos del almacenamiento referenciados por cualquiera de ellos.
- Fuera: chat y estado del asistente, costes y evaluaciones IA, votaciones y marketplace.

## Formato
ZIP (`fflate`): `manifest.json` (versión de formato, organización y proyecto de origen, filas) y `assets/<key>`.

## Importación
1. `startProjectImport` devuelve una subida presignada a `imports/{org}/{uuid}.habiteka` (≤ 500 MB).
2. `finishProjectImport(key)` comprueba el prefijo de la organización, lee el ZIP y valida el formato.
3. Ids nuevos para todas las filas. Se reescriben strings JSON idénticos a un id o a una key exportada, y los fragmentos con el proyecto u organización de origen.
4. Keys con proyecto u organización de origen se reescriben con los nuevos (mantienen las comprobaciones de propiedad por prefijo); el resto va a `imports/{proyectoNuevo}/…` para no compartir objetos entre proyectos.
5. Aprobaciones a nombre de quien importa. `assetUrl` se regenera.
6. Inserción en transacción, en orden de claves foráneas; archivos subidos antes. Se borra el ZIP subido.

## Interfaz
- Menú de cada proyecto en «Proyectos»: Exportar proyecto.
- Página «Proyectos»: Importar proyecto.
- Menú del editor: Exportar proyecto.

## Aceptación
- Ida y vuelta en test: el proyecto importado tiene las mismas filas, documentos y archivos, con ids y keys nuevas, sin referencias al proyecto de origen.
- Comprobaciones de propiedad por prefijo (sitio geográfico) siguen pasando.
- Documentación de usuario y novedades.
