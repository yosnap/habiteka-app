# Organización de elementos y biblioteca personal

`EditorDocument.elementGroups` y `lockedElementIds` son campos opcionales compatibles con documentos anteriores. Pertenecen a la planta; `levelDocument` los conserva al cambiar de nivel. `assertElementOrganization` valida nombres, pertenencia única y referencias de grupos. Las eliminaciones podan grupos huérfanos.

El store expande selecciones por grupo y admite selección individual explícita para Propiedades. `assertLockedElementsUnchanged` compara las entidades protegidas y sus dependencias **después** de normalizar, reconciliar techos y resolver apoyos. Esto protege frente a cambios indirectos y borrado de plantas inactivas. Las acciones de bloqueo se guardan en el historial; deshacer el propio bloqueo permite volver a editar.

`element-packages.ts` extrae las colecciones seleccionadas y sus soportes, sin transportar comentarios, imágenes, recorridos ni metadatos del proyecto. Remapea IDs de entidades, piezas internas, soportes y estancias derivadas antes de insertar. Las nuevas copias no heredan candados y comparten una sola entrada de historial. La colocación usa el modo de objetos pendiente en Plano 2D y conserva el paquete pendiente cuando la validación rechaza el lugar.

La biblioteca usa la tabla `element_package`, migración `20261011040000_element_packages`. Ejecutar `prisma generate` y `prisma migrate deploy` al actualizar el entorno. La tabla pertenece al usuario, con borrado en cascada al eliminar su cuenta. Las acciones resuelven `userId` desde la sesión y filtran tanto lectura como borrado por ese titular; no reciben identidad del cliente. La biblioteca sigue disponible al cambiar de proyecto u organización activa con el mismo usuario.

Los paquetes se validan de nuevo en el servidor y al insertar: máximo 300 entidades independientes y 1 MB por documento. Las miniaturas SVG representan la distribución del contenido guardado. No se consumen proveedores IA ni se aceptan diseños en este flujo. La guía pública está en `docs/site/src/content/docs/editor/grupos-paquetes.md`.

`replaceFurniture` conserva identidad, centro, giro, nombre y pertenencia al grupo; toma medidas y acabados del catálogo. Comprueba soportes existentes antes de entregar el candidato al control geométrico del store. Puertas y ventanas reutilizan `setOpeningType` y sus reglas de ajuste de medidas.

Verificación: pruebas de documento y store en `tests/editor-document/element-organization.test.ts`; aislamiento y persistencia PostgreSQL en `tests/server/element-packages.test.ts`. Las pruebas de servidor requieren una base local con marcador `habiteka-isolated-test-v1`; nunca ejecutarlas sobre desarrollo ni producción.
