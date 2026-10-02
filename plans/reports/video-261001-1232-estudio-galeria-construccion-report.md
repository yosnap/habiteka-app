# Estudio, renders y construcción — 1 octubre 2026

## Resultado implementado

- La pestaña **Vídeos** reúne construcción, publicidad, primera persona y construcción + visita. Tejado, parcela, aprobación, iluminación, recorrido, sonido, creación, reproducción y descarga se preparan en el estudio.
- Construcción independiente de 30 segundos, sin exigir recorrido interior. Durante la obra la cámara queda fija; los muros crecen uno a uno por grupos estables del plano. Sus fragmentos y cierres hasta cubierta crecen juntos. El vuelo final empieza después de terminar la obra.
- FX locales de roce/impacto sincronizados con el inicio de cada muro; volumen y cotas opcionales. No se ha añadido música ni audio externo.
- **Solo la casa** es el ámbito inicial: conserva interiores y tejado completo, recorta tapado y superficies, y excluye terreno modelado, piscina, jardín y objetos exteriores. La ortofoto confirmada permanece visible. Todo el plano permite incluir el exterior.
- La exportación usa la revisión aprobada; permiso, revisión, huella y ámbito se comprueban al preparar y finalizar la subida. No necesita aprobar otra revisión para exportar nuevamente el mismo contenido.
- Los renders de una tanda se agrupan en una galería. Estancia/zona y cámara figuran en los títulos. Al abrir una imagen aparecen las cuatro acciones: fondo de plano, descarga, cambios y variante.
- El fondo guarda un ID estable y valida permiso y revisión, evitando sobrescribir cambios concurrentes. No se ha aplicado un nuevo fondo al plano real durante las pruebas.
- Los recortes laterales conservan tabiques interiores y ocultan únicamente muros exteriores que miran a cámara y sus accesorios. El rediseño solicitado admite mobiliario nuevo, mantiene distribución y exige permiso independiente para fijos. Auditoría y coherencia del montaje distinguen interiorismo conservado y rediseñado.

## Revisión de referencias y exportaciones

Se revisó visualmente en Chrome el segmento indicado de YouTube (00:07–00:39), con posiciones de 8, 13, 18, 23, 28, 33 y 38 segundos: estructura, fachada terminada, vuelo e interiores. No se ha hecho un análisis exhaustivo de todos los fotogramas ni del audio de esa referencia.

Se crearon tres exportaciones nativas en el proyecto real, sin editar ni aprobar su diseño. La primera permitió detectar el terreno exterior y las paredes simultáneas. La segunda confirmó la secuencia pero mostró tapado sobrante y caras de fachada recortadas. La tercera incorpora las correcciones.

Última exportación: revisión 156, **Solo la casa**, creada a las 13:10:20. Archivo guardado `ed445fbd-492b-419b-8498-302fad0c1a01.mp4`. Inspección con FFprobe: H.264, 1920 × 1080, 30 fps, pista AAC, 30,08 segundos. La hoja de 15 fotogramas, muestreados cada 2 segundos, muestra crecimiento progresivo, fachadas completas y ausencia de plataforma modelada exterior. El archivo contiene audio; su calidad perceptiva aún debe valorarse escuchándolo.

La ortofoto sigue siendo una imagen plana y el tapado es una superficie uniforme. El vídeo nativo todavía presenta el aspecto del editor y no alcanza el acabado fotorrealista de las referencias. No dar esta fase por terminada con el MP4 de prueba.

## Verificación

- 126 pruebas de 17 archivos, todas correctas: galería, estudio, ámbitos, fondos, secuencia/FX, aislamiento, visibilidad, prompts, auditoría y acciones de exportación.
- TypeScript sin errores.
- ESLint de 158 archivos modificados/nuevos: se corrigieron sus dos avisos y la comprobación enfocada posterior terminó sin avisos.
- `git diff --check` correcto; ningún archivo de código modificado/nuevo supera 1000 líneas.
- `docs:updates` correcto. Construcción Starlight con 17 páginas; comprobación Astro sin errores, avisos ni sugerencias.
- Navegador: estudio, creación y persistencia del MP4, biblioteca, galería y sus cuatro acciones; el selector del tejado mantiene su diálogo.
- La capacidad de cambiar el viewport no modificó el tamaño real de Chrome: no se afirma validación móvil. Se restableció la configuración y se cerró la pestaña duplicada de prueba.
- No se han realizado generaciones de IA de pago, enviado medios del proyecto a proveedores externos, desplegado ni creado un commit.

## Pendiente para la película profesional

1. Animación continua desde los **diseños generados**, incluyendo identidad del mobiliario; los vídeos nativos usan muebles del editor. El montaje de renders disponible solo mueve y funde imágenes.
2. Fotogramas coherentes de estados de obra, exterior terminado con cubierta e interiores a altura de ojos. Las referencias laterales seccionadas no bastan para una fachada cerrada.
3. Integración de proveedor, acceso API, tareas persistentes, presupuesto, transferencia de medios y recuperación de resultados. Se ha consultado la API oficial de Kling 3.0 en Higgsfield; permite referencias inicial/final y sonido, pero no garantiza fidelidad arquitectónica.
4. Auditoría temporal antes de admitir clips: casa, cubierta, aleros/pérgolas seleccionados y muebles constantes; rechazar pérdida de identidad, deformaciones, cambios de textura y muros que aparezcan juntos.
5. Sustitución visual de la construcción existente sin superficie de tapado artificial, y revisión perceptiva de audio y calidad de imagen.

La consulta sobre acceso API a Higgsfield sigue pendiente de respuesta. No se han pedido claves por chat. La fase 05 permanece abierta.

Guías y detalles: [documentación técnica](../../docs/estudio-videos-galeria.md), [estudio de vídeos](../../docs/site/src/content/docs/videos/estudio.md), [imágenes](../../docs/site/src/content/docs/guias/imagenes.md).
