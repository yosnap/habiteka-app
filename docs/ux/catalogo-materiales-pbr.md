# Catálogo de materiales PBR

Implementado en el worktree `habiteka-app-feat-editor-v2`, 8 de septiembre de 2026.

## Uso

- Seleccionar el suelo de una habitación cerrada → desplegar **Suelo: Sin textura**.
- Seleccionar una pared → **Pintar** → desplegar **Interior** o **Exterior**.
- Buscar por nombre o filtrar por categoría y pulsar una miniatura.
- **Quitar textura** vuelve al acabado liso. El suelo permite ajustar repetición y giro.
- Las paredes mantienen su representación neutra en 2D y su coronación gris en 3D.
- Cada cara de pared conserva su material y color independientemente.

## Contenido y procedencia

60 materiales: 12 maderas, 12 cerámicas, 3 mármoles, 6 piedras, 7 hormigones,
8 ladrillos, 8 revestimientos y 4 telas. Las telas son acabados de superficie;
esta entrega no añade edición de tapicería por partes a los muebles GLB.

Fuente: Poly Haven, licencia CC0: https://polyhaven.com/license
Cada entrada conserva enlace al original, autores, dimensiones físicas y MD5 de los mapas.
Archivos locales en `public/materials/polyhaven`, aproximadamente 103 MB.
Tres mapas JPG 1K por material: color, normal OpenGL y rugosidad; miniatura WebP de 160 px.
No se descargan los 60 materiales al abrir el editor: los mapas 3D se cargan bajo demanda.
No hay desplazamiento geométrico, para no alterar esquinas ni los huecos de las paredes.

## Implementación

- Importación acotada y reproducible: `scripts/download-surface-materials.mjs`.
- Registro: `src/lib/editor-document/surface-materials.ts`.
- Selector compartido: `surface-material-picker.tsx`.
- Material 3D: `scene/surface-material.tsx`; color sRGB, datos sin transformación de color,
  texturas clonadas por repetición y liberadas sin destruir la caché compartida.
- Identidades existentes: `wall.materials.left/right`; suelo `texture: polyhaven:<id>`.
- IDs de suelo verificados contra el catálogo; no se cargan URLs arbitrarias del documento.
- Fallback a color liso si falla una textura. Actualmente no presenta aviso de error de carga.

## Verificación

- 60 materiales / 180 mapas: integridad verificada contra los MD5 de la fuente.
- Tipos y lint de los componentes afectados: correctos.
- Suite de editor/documento y canvas: 558 pruebas correctas, 3 omitidas.
- Comet: selector de 60 entradas, búsqueda, suelo de madera, ladrillo interior,
  continuidad visible en pared curva y coronación neutra.
- No se ha realizado una revisión visual individual de los 60 materiales.
- Build aislado correcto antes de los últimos ajustes de inspector y coordenadas UV.
- Se observó una pérdida puntual de contexto WebGL, posteriormente recuperada;
  causa no confirmada. Pendiente prueba prolongada de estabilidad gráfica.
- La persistencia de la vista previa sigue limitada a la copia de la pestaña;
  esto no implementa el guardado de la vista previa en proyecto.

### Prueba de estabilidad posterior

En Comet, pestaña de prueba independiente, sin editar código durante la ejecución:

- 20 ciclos completos 2D → 3D sin aviso de interrupción.
- 10 cambios iniciales y recorrido de las 60 opciones de material sobre una pared curva.
  Las 60 selecciones confirmadas mediante `aria-pressed`; render final rojo comprobado visualmente.
- 10 ciclos deshacer → rehacer sin interrupción.
- Recarga y vuelta a 3D: pared curva y acabado conservados visualmente.
- Sin errores de consola; avisos existentes de PCFSoftShadowMap obsoleto y capas Konva.

No se reprodujo la pérdida anterior de contexto. No se ha demostrado su causa ni se
declara corregida. Esta prueba de estrés acotada no equivale a una sesión de varias horas
ni certifica el render individual de cada material. No se modificó código durante esta prueba.
