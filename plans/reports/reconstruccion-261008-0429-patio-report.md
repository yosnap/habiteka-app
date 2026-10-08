# Prueba local de reconstrucción del patio

## Resultado

Escena Blender editable, comparación con la imagen aceptada y paneo local de dos
segundos. La prueba verifica preparación y render de una escena fija, pero **no
alcanza la apariencia ni fidelidad del diseño aceptado**. No es un paseo completo.
No se publicaron entregables ni se aceptaron imágenes en nombre del usuario.
No se hicieron llamadas de pago de imagen, análisis o vídeo.

Artefactos privados excluidos de Git en `plans/reports/offline-reconstruction-261008/`:

- `comparacion.html`: referencia aceptada frente al render y reproductor del paneo.
- `reconstruction-draft.blend`: escena editable con referencias empaquetadas.
- `reconstruction-draft.png`: imagen 1280 × 720, 96 muestras Cycles Metal.
- `paneo-borrador.mp4`: 2 s, 960 × 540, 24 fps, 48 fotogramas, 555121 bytes.
- `design-manifest.json`, `scene.json`, `render-report.json` y `motion/motion-report.json`.

## Implementación

CLI de solo lectura: revisión aprobada y comprobación de referencias aceptadas.
Manifiesto explícito de 35 piezas, materiales y procedencia visual; 705 mallas de
arquitectura. No copia automática del mobiliario del editor. Fuente cuadrada baja
y cuatro plantas definidos a partir del diseño; salón y estudio aproximados para
examinar vistas contiguas. Modelos locales elegidos manualmente, sin reconstrucción
automática a partir de los píxeles. Cubierta, huecos y cámaras proceden de la geometría.

Se extrajo la función geométrica de cubiertas de carpa a un módulo compartido sin
React para poder usarla desde la CLI `react-server`. El editor conserva el mismo
generador. Los scripts de Blender convierten ejes, cargan materiales/modelos y
renderizan con Cycles; el paneo configura Metal al abrir de nuevo la escena.

## Inspección visual y límites

Comparados referencia, render completo y fotograma final del paneo. El resultado
presenta vegetación distinta, texturas aproximadas, composición descentrada de la
fuente respecto a la foto, cubierta sin correspondencia visual suficiente y zonas
contiguas incompletas. No se atribuye todavía cada discrepancia a la IA o al
exportador sin calibración adicional. Ningún muro se movió para disimularlas.

El paneo gira 12 grados sobre un punto fijo: no comprueba colisiones ni un paseo
transitable por toda la vivienda. Conserva geometría y objetos en todos sus
fotogramas; falta evaluar calidad temporal en un recorrido y resolución finales.
La luz de día es provisional y las caras compartidas necesitan materiales propios.

Una imagen final tardó 11,02 s incluyendo preparación. El movimiento tardó 63,61 s
en Metal con 32 muestras. No extrapolar estas cifras a garantía de calidad, tiempo
o precio de un minuto. El gasto en proveedor IA de esta prueba es cero; no incluye
electricidad, amortización ni eventual cómputo remoto. No se ha validado un coste
de producción de ≤2 € para la casa completa con esta vía.

## Verificación

- 10 pruebas: contrato de referencias/materiales, rutas de modelos, exclusión de
  mobiliario implícito y geometría compartida de cubierta; todas pasan.
- TypeScript y ESLint de los archivos afectados: correctos.
- `npm run docs:updates` y `npm run docs:build`: correctos.
- `git diff --check`: correcto.
- MP4 verificado con ffprobe: 48 fotogramas y 2 s exactos.

Documentación técnica: `docs/reconstruccion-local-disenos.md`. El flujo de usuario
sigue igual; no hay un nuevo botón ni exportación final a partir de este borrador.
Sigue pendiente una reconstrucción fiel antes de habilitar el paseo completo.
