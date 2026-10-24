# Opciones de escena y exploración del plano guía

Implementado localmente sobre la referencia visual aportada por el usuario. Sin cambios a coordenadas constructivas, contratos IA o aceptación de diseños. Sin gasto, commit, push ni despliegue.

- Menú superior derecho con submenús, búsqueda Ctrl/Cmd+K y retorno por teclado. En móvil se limita al espacio disponible y desplaza su contenido.
- Plantas apiladas, separadas 4 m adicionales por nivel y planta activa aislada sin techo. Separadas destapa niveles inferiores y conserva cubierta superior. Capturas y recorridos recuperan cotas reales.
- Visibilidad de paredes/huecos, jardín/terreno, estilos cromáticos, cuadrícula, nombres y medidas generales métricas/imperiales. Son preferencias temporales de vista; los campos de construcción siguen en metros.
- Exploración por clic: raycast al primer objeto visible, validación de suelo/planta, búsqueda existente de ruta transitable y desplazamiento con colisiones. Arrastrar mira; entrada manual cancela destino; pausa detiene. El clic no navega entre plantas. La marcha por escaleras conserva el mecanismo existente.
- Exploración identificada como plano guía, separada de visitas finales con diseños aceptados. No solicita bloqueo del ratón automáticamente.

## Validación

- 64 pruebas correctas en 8 archivos: opciones, atajos, navegación, plantas, marcha libre y árbol de escena.
- TypeScript, ESLint, `git diff --check`, comprobación de documentación y compilación de aplicación correctos.
- Documentación Starlight: 19 páginas, incluida guía de Opciones enlazada en navegación.
- Navegador de muestra: búsqueda con foco; dos plantas duplicadas solo en muestra aislada y vista separada; medidas de 10 × 8 m visualizadas como 32.81 × 26.25 ft; cambio de estilos; menú de 360 px dentro de pantalla (borde inferior 984 px en viewport de 1000 px).
- Clic real de interfaz en suelo visible atravesó una puerta abierta hasta la estancia contigua, confirmado por cambio del marcador del miniplano. Un clic en superficie no transitable devolvió indicación y mantuvo la posición.
- Los proyectos privados y las capturas proporcionadas no se copiaron al repositorio.

## Límites documentados

Las unidades se aplican a las nuevas medidas generales y al paso de cuadrícula. Los nombres/medidas son de la planta activa. Las preferencias no se persisten al cambiar de modo o recargar. El clic se limita al suelo visible de la planta actual. No se implementa una visita final basada en el 3D guía.

Cuestiones abiertas: ninguna necesaria para esta entrega.
