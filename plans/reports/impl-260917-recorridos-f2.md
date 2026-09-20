# F2 — Recorridos nativos completados

Fecha: 17/09/2026. Rama: `feat/planos-ia`. Sin commit ni despliegue remoto.

## Resultado

Botón Recorrido → elegir estancias → preparar ruta automática o dibujar puntos → ajustar
posición, altura, velocidad, pausa y orientación → ver en 3D → exportar MP4.
Las rutas se guardan por planta en EditorDocument v9, con deshacer/rehacer y recalibración XY.
Los vídeos aparecen en Diseños e Historial, sin gasto de IA.

## Decisiones

- Puertas transitables y estancias seleccionadas definen el espacio permitido. A* con límites
  evita muebles y otros obstáculos. Ventanas y puertas cerradas no son pasos.
- Spline Catmull-Rom validada por muestras; fallback recto comprobado. Un tramo no transitable
  queda señalado y bloquea reproducción y exportación.
- La cámara conserva altura física y añade elevación de planta. FOV 75° y pitch inicial −8°.
- WebCodecs + Mediabunny codifica a tiempo fijo 1080p30/H.264; equipo lento no acorta vídeo.
  [mp4-muxer está deprecado](https://github.com/Vanilagy/mp4-muxer).
  [Documentación Mediabunny](https://mediabunny.dev/guide/writing-media-files).
- Subida presignada con ticket HMAC ligado a organización/usuario/proyecto/ruta/tamaño y 5 min.
  Se revalida acceso; inspección de tamaño, MIME y cabecera; objeto final sin URL de escritura.
  Registro de entregable y evento de uso cero en transacción. Reintento después de promoción
  y finalizaciones concurrentes no duplican el registro.
- La exportación se cancela si cambia el documento. Capturas y vídeo comparten cola; controles
  de cámara/iluminación quedan bloqueados durante la grabación.

## Validación

- 238 pruebas aprobadas en 40 archivos (documento/editor, techos y acciones de vídeo).
- Incluye fixture de tres estancias: recorrido válido por puertas; falta de pasillo, muros,
  ventanas, obstáculos, puertas cerradas, pausas, escala, persistencia y plantas.
- Pruebas de acciones con dobles: rechazo de organización ajena antes de storage, revocación
  de acceso, reintento tras promoción, idempotencia y rechazo de MIME incorrecto.
- `bun run build`: correcto. Avisos existentes por OAuth social no configurado localmente.
- ESLint del código de recorridos, vídeo e historial: correcto.
- Navegador: proyecto propio de validación `cmu5rbo8v000ak2msrpfdhono`, ruta guardada 10,6 s.
  Exportación real, subida MinIO y entregable `video-fbd1e2a3-45ed-479a-b8c4-c89b63263b42`.
- `ffprobe` del objeto final: H.264, 1920×1080, 30/1 fps, duración 10,600000 s, 318 frames,
  557269 bytes. Abierto en reproductor de Diseños.
- Primer guardado detectó singleton Prisma dev anterior al enum VIDEO. Reiniciado dev,
  repetida exportación y guardado correcto. No era fallo del archivo ni de la migración.

## Despliegue y límites

Aplicar `20260917174000_native_walkthrough_video`, regenerar Prisma y reiniciar aplicación.
Migración aplicada solo en `habiteka_dev` local. No se reseteó la base de datos.
Una planta por ruta; exportación 0,1–60 s / máximo 100 MB; requiere H.264 WebCodecs disponible.
El aspecto sigue siendo el render 3D nativo; calidad fotorrealista/keyframes son F3/F4.
Selección de orientación explícita disponible para evitar encuadres mirando una pared.
Muebles importados (#41) y color emitido RGB (#42) continúan aplazados por el usuario.
