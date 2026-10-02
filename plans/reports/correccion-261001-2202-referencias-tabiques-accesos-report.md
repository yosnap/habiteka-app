# Corrección de referencias para construcción — 01/10/2026

## Resultado

Las fotos antiguas Frontal, Trasera e Izquierda del diseño aprobado de FInca quedan visibles, señaladas como **No válida para construcción** y sin selección. Las tres contienen tabiques interiores en el recorte registrado; se bloquean al preparar y al enviar una preparación antigua, antes de reserva, credenciales o transferencia.

La preparación local y el servidor de imágenes aplican la misma comprobación antes de generar nuevos renders. No se corrigen píxeles de fotos existentes cambiando su metadata.

## Comprobación sobre el proyecto real

Documento aprobado: revisión 156. Tanda examinada: `4954cc10-db5f-4901-9662-ef663c1cbb3e`. Diagnóstico y comparación visual previos: `diagnostico-261001-2131-paredes-accesos-h3-report.md` y `diagnostico-261001-2131-plano-fotos-video.jpg`.

| Vista | Muros ocultos registrados antes | Tabiques interiores ocultos antes | Muros ocultos recalculados ahora con cámara y zonas guardadas | Tabiques interiores ocultos ahora |
|---|---:|---:|---:|---:|
| Frontal | 14 | 8 | 1 | 0 |
| Trasera | 24 | 9 | 6 | 0 |
| Izquierda | 18 | 8 | 3 | 0 |

El recálculo usa `zoneOccludingWallIds`, las cámaras guardadas y los polígonos del ámbito de las fotos. Además, se prepararon gratuitamente las tres vistas actuales en el editor, con Atardecer y Toda la planta; pasaron la comprobación del recorte. Se inspeccionaron ampliadas Frontal e Izquierda. Este segundo encuadre incluye la parcela y no sustituye las fotos seleccionadas del piloto ni acredita los píxeles de una nueva generación IA.

El guion del mismo conjunto identifica **dos escaleras rectas de 16 peldaños, una rampa inclinada y dos descansillos planos**, con origen local, huella y giro. Solo se incorporan accesos de los ámbitos referenciados; el módulo no lee mobiliario. El guion equivalente del conjunto tiene 4370 caracteres, dentro del máximo de 7000. En nuevas preparaciones se congela el texto como `structuralConstraints` y se incorpora al prompt revisable.

## Verificación

- 40 pruebas aprobadas en 8 archivos: recorte, tabiques abiertos, plantas, selección de accesos por huella, fuentes de vídeo, bloqueo previo al envío, preparación y visibilidad de escena.
- TypeScript y ESLint de los archivos afectados: sin errores.
- `git diff --check`, `npm run docs:updates` y `npm run docs:build`: correctos; 17 páginas HTML construidas.
- Estudio comprobado en el navegador: Frontal/Trasera/Izquierda desactivadas y con explicación; Dron/Isométrica/Cenital siguen disponibles.

## Límite y siguiente paso

No se generó otra foto ni otro vídeo de pago. El clip existente sigue rechazado; estas correcciones no prueban que H3 vaya a respetar las restricciones. Falta reemplazar las fotos defectuosas, completar una referencia de exterior terminado con cubierta y revisar las imágenes antes de otra prueba con presupuesto autorizado. La validación de metadata no sustituye la auditoría visual de renders ni la revisión temporal del vídeo.

Guías públicas actualizadas: `videos/estudio`, `guias/imagenes`, `ayuda/novedades`. Referencia técnica: `docs/estudio-videos-galeria.md`. Cambios locales, sin commit ni despliegue.
