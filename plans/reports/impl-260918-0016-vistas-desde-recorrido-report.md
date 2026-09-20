# Vistas individuales desde puntos del recorrido

Estado: incremento funcional de F3; fase completa todavía en curso. Sin commit/despliegue.

## Entregado

- Contrato `CameraPose` validado: posición/foco en metros relativos a planta, FOV y levelId.
- Recuperación de foco desde quaternion para capturas antiguas; rechazo de orientación nula.
- Extracción de pose por waypoint reutilizando geometría de reproducción y validación de ruta.
- Acción **Diseñar desde este punto** abre la escena y el diálogo existente de render.
- Captura interior con paredes/techo físicos; restaura cámara, FOV, controles, selección y luz.
- Cambiar iluminación/preparar Vista actual conserva pose; otros presets conservan su función.
- `payload.camera` tanto en render IA desde escena como en PNG nativo. Validación antes de IA.
- Compatibilidad con clientes antiguos: parámetro de vista opcional en `saveNativeRender`.

## Verificación

- 247 pruebas en 41 archivos: documento/editor, poses, prompts de vista/techo/concepto.
- TypeScript, ESLint del incremento y build correctos. Build avisa OAuth local sin configurar.
- Navegador: proyecto de prueba `cmu5rbo8v000ak2msrpfdhono`, punto1 de ruta persistida;
  diálogo desde interior, cambio a noche y previsualización ampliada comprobados.
- Exportación PNG real guardada en Diseños. Consulta de solo lectura confirma `camera` con
  position/focus/fovDeg45/levelIdnull en entregable
  `del-cmu5rbo8v000ak2msrpfdhono-render3d-ecd9fe1f-14da-43ef-a705-5005abd48f13`.
- No se ejecutaron generaciones pagadas; no se afirma fidelidad fotorrealista comprobada.

## Pendientes F3

Storyboard persistido y reordenación/sustitución, anclaje manual de imágenes antiguas,
subida presignada KEYFRAME con máscara, reserva parcial por lote, semilla/referencia anterior,
medición de consistencia/reintento y prueba visual de cinco resultados reales.
