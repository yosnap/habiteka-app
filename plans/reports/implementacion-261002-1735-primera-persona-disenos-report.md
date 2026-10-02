# Primera persona desde diseños — 02/10/2026

## Entrega

- `Primera persona → Mis diseños`: piloto H3 de 8/12 s dentro de una estancia, con nombre, sonido solicitado, indicaciones, referencias, guion y presupuesto. Usa la misma persistencia y recuperación del piloto de construcción; modo JSON `walkthrough-ai`, sin migraciones.
- Cámara y estancia verificadas contra el documento aprobado; paredes, objetos y techo completos. No admite vistas aéreas/recortadas, referencias rechazadas, mezcla de estancias/tandas ni versiones visuales obsoletas. Revalida antes de enviar.
- Primer diseño seleccionado fija mobiliario y acabados. Se pide movimiento corto en la estancia terminada, sin fases de obra, accesos nuevos ni recuperar muebles del plano. La fidelidad requiere revisión humana.
- Interiores por defecto; otras vistas se pueden mostrar aparte. Limpiar permite ver todas y no reclasifica una imagen aérea como rechazada. Enlace al flujo existente de crear interiores, sin generar automáticamente.
- Galerías, Diseños e Historial reconocen la modalidad. Publicidad necesita aceptación del clip; renombrado bloqueado durante un envío, también en servidor.
- Guía pública de recorrido, tablas del estudio, tipos, novedades y referencia técnica actualizadas.

## Verificación

- 56 pruebas enfocadas correctas en 6 archivos. Incluyen 12 de cámara/selección/guion y 8 con PostgreSQL real aislado para recuperación, ámbito, nombres y limpieza. Pruebas de preparación/envío confirman ausencia de reserva/transferencia durante preparación y bloqueo antes de credenciales o subida al cambiar las referencias.
- Corregido un literal de luz inválido detectado por TypeScript en la prueba nueva; repetidas sus 12 pruebas y tipos, correctos. El primer comando de pruebas sin destino aislado fue bloqueado por la protección de DB; los resultados válidos usan la base marcada de pruebas, sin reset de desarrollo.
- ESLint de archivos afectados y `git diff --check` correctos. Compilación Next de producción correcta en el worktree de revisión; advertencias limitadas a credenciales de prueba. `docs:updates` y `docs:build` correctos, 17 páginas.
- Comet local: se abre Primera persona desde mis diseños, controles de 8 s/768P, indicaciones y nombre; se comprueba bloqueo de las referencias actuales, todas aéreas/laterales/exteriores. Sin modificar ni aprobar el diseño. La comprobación visual fue anterior al ajuste final para ocultar otras vistas por defecto; ese ajuste queda validado por tipos/lint/build, sin afirmar una verificación visual adicional.
- Contrato de referencia H3 vuelto a consultar en [KIE](https://docs.kie.ai/market/minimax-h3/reference-to-video). La página de tarifa no respondió; se conserva el presupuesto orientativo documentado del 01/10/2026, sin certificar una actualización de precio ni el saldo real.

## Pendiente

- Crear al menos una imagen interior coherente con el diseño aprobado; las referencias actuales no permiten el piloto en primera persona. No se ha generado ni certificado un nuevo clip.
- Autorizar referencias y presupuesto antes de una prueba pagada; consumo de esta intervención: **0 USD**. No se cambia el límite de IA.
- Verificar fidelidad temporal y movimiento del piloto, recorrido entre habitaciones mediante accesos reales y composición de construcción + interiores. La muestra combinada actual sigue usando 3D.
- Los cambios son locales; no se despliegan ni se publica una nueva versión.
