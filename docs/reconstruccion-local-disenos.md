# Reconstrucción local desde diseños aceptados — experimental

Herramienta de desarrollo fuera del flujo de producción. El flujo de usuario
sigue igual: no añade un botón de Blender ni habilita un paseo final desde el 3D.
No genera imágenes con IA, no acepta referencias, no modifica el proyecto y no
publica entregables. Los resultados son **borradores de reconstrucción**.

## Preparación y procedencia

`scripts/reconstruction/prepare-draft.ts` lee un paseo guardado, su aprobación
inmutable, sus anclas aceptadas y un encuadre aceptado. Reutiliza las comprobaciones
de organización, versión, luz, cámara, puertas y aceptación humana del paseo.
Resuelve el rol real del miembro que aceptó el encuadre. Es una CLI administrativa
local con acceso a la base; no es una ruta pública ni crea una sesión.

El manifiesto JSON requiere `purpose: reconstruction-draft`, `referenceIds`,
`materials`, `defaults`, `surfaces`, `objects` y `unresolved`. Cada superficie y
objeto explícito se vincula a una referencia aceptada con una explicación visual.
El mobiliario del editor **no se copia automáticamente**. Los modelos GLB y las
formas simples se incorporan únicamente si están descritos en ese manifiesto.
Esta vinculación permite revisar la procedencia; no certifica parecido visual.

La arquitectura conserva muros, huecos, suelos y sus vacíos, techos explícitos,
cubierta y acristalamientos, cierres, porches y cerramientos. Las cubiertas de
carpa reutilizan `hip-roof-mesh.ts`, también utilizado por el editor, sin duplicar
su geometría. Plantas adicionales, rampas o avisos de geometría bloquean el borrador.
Los cerramientos y porches conservan sus volúmenes guía; sus acabados también
necesitan revisión antes de cualquier resultado final.

Los materiales parten de colores y texturas locales elegidos al comparar los
diseños. No se extraen automáticamente de las fotografías. Los modelos de catálogo
son aproximaciones y pueden no reproducir sus piezas exactas. Una imagen plana
no aporta por sí sola las superficies ocultas ni convierte la casa en un modelo 3D.

## Ejecutar sin llamadas IA

Guardar manifiesto, imágenes y resultados en una carpeta privada. La preparación
rechaza las carpetas `public` y `docs`; no usar tampoco directorios sincronizados
o publicados. Los IDs del ejemplo son marcadores, no datos de un inmueble.

```sh
bun --conditions=react-server scripts/reconstruction/prepare-draft.ts \
  --visit ID_PASEO --image image-2 \
  --design /ruta/privada/manifiesto.json --out /ruta/privada/borrador

blender --background --python scripts/blender/reconstruction_render.py -- \
  --job /ruta/privada/borrador/scene.json --samples 64 --width 1280
```

El paquete guarda las referencias aceptadas y la cámara original. En Blender se
convierten los ejes `(x, y, z)` de Three a `(x, -z, y)`; se mantiene el FOV vertical.
Para formas, `position` es el centro; para GLB y fuentes, el centro de la base.
`size` sigue los ejes de Three en metros y `rotation` es un giro Y en radianes.
Los modelos se normalizan por sus límites y admiten tintado de materiales nombrados.

Cycles intenta usar Metal en macOS y usa CPU si no está disponible. Guarda
`reconstruction-draft.blend`, `reconstruction-draft.png` y `render-report.json`
con tiempo, dispositivo y `eligibleForFinalVideo: false`. La iluminación de día es
provisional: no reproduce todavía el sol del proyecto. Las texturas usan color y
rugosidad con proyección de caja; los mapas normales tangentes no se aplican sin UV.

Para comprobar continuidad con un paneo corto, conservando todos los objetos:

```sh
blender --background /ruta/privada/borrador/reconstruction-draft.blend \
  --python scripts/blender/reconstruction_motion.py -- \
  --out /ruta/privada/secuencia --frames 48 --degrees 12
ffmpeg -framerate 24 -i /ruta/privada/secuencia/%04d.png \
  -c:v libx264 -pix_fmt yuv420p /ruta/privada/paneo-borrador.mp4
```

El paneo gira sobre un punto fijo y **no demuestra un recorrido transitable**.
El manifiesto enumera lo pendiente; la escena no puede pasar a producción por
haber renderizado o superado pruebas. Tampoco se promete el coste de un minuto a
partir del tiempo de una imagen: hay que medir el movimiento, calidad, equipo y
coste de procesamiento completos. No hay tarifa de proveedor IA en estas herramientas.

## Criterio de revisión

Comparar el render con la referencia aceptada, manteniendo primero su cámara:
posición de huecos, cubierta, proporciones, piezas, vegetación, acabados y luz.
Si la fotografía ha alterado la perspectiva o arquitectura, registrar el conflicto;
no mover muros para disimularlo. Revisar el movimiento para detectar ruido temporal,
reflejos y oclusiones. Las zonas sin reconstruir y las diferencias visuales impiden
presentar este borrador como paseo completo hiperrealista.
