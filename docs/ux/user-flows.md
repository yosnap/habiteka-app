# Flujos de trabajo de Habiteka

## Estado actual y dirección de UX — 10 de octubre de 2026

La guía vigente de las funciones disponibles está en [Tu primer proyecto](../site/src/content/docs/guias/primer-proyecto.md), [Guardar y aprobar](../site/src/content/docs/guias/guardar-aprobar.md), [Crear imágenes](../site/src/content/docs/guias/imagenes.md) y [Tipos de vídeo](../site/src/content/docs/videos/tipos.md).

El proyecto ofrece Asistente, Plano, Editor, Diseños, Vídeos e Historial. El editor reúne Plano 2D, Amueblado y Modelo 3D; su 3D prepara y comprueba geometría. La aprobación del plano y la aceptación humana de cada imagen IA son decisiones distintas. Los resultados finales requieren diseños aceptados y referencias compatibles.

La [referencia WalkMyHome](walkmyhome-reference.md), revisada en Comet, orienta **vistas y diseño** de navegación, paneles y asistente junto al lienzo, con escritorio, tableta y móvil desde el inicio. **Se conservan todas las funcionalidades/opciones de Habiteka y el método de construcción y edición del plano 2D.** El [plan](../../plans/261010-0427-referencia-walkmyhome/plan.md) implementa una barra izquierda con modos/tareas, Ayuda y Ajustes inferiores, paneles flotantes y asistente existente por proyecto/zona. Diseños y Vídeos comparten una composición más amplia; el estado local de navegación queda separado del guardado. Las funciones propias se adaptan visualmente; no se incorporan motores externos. La visita continua sobre diseños aceptados conserva su estado pendiente en su plan funcional propio. Audio del espacio de trabajo: futuro.

## Modelo histórico del agente

La tabla y los wireframes iniciales que siguen describen el planteamiento original. No prueban disponibilidad actual de sus botones, stepper, gratuidad, marketplace o resultados. Contrastarlos con Starlight y código antes de reutilizarlos.

> El usuario **nunca ve** los nombres internos de fase. La columna "Fase interna"
> es solo para el equipo; el "Lenguaje de producto" es lo que ve el usuario.

| Fase interna     | Lenguaje de producto    | Entrada                  | Acción del usuario                                   | Salida visible                                                            |
| ---------------- | ----------------------- | ------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Ingesta       | "Sube tu espacio"       | Imagen/dibujo/plano      | Arrastra imagen, dibuja in-app o sube plano          | Análisis visual (skeleton) → elementos detectados + disclaimer conceptual |
| 2. Cualificación | "Cuéntanos qué quieres" | Diálogo                  | Responde el chat (objetivo, estilo, qué entregables) | Resumen de preferencias confirmable                                       |
| 3. Entrega       | "Tus diseños"           | Preferencias confirmadas | Pulsa "Generar" (ve coste: GRATIS o ~N créditos)     | Plano 2D acotado, render 3D y/o memoria, con sello legal                  |
| 4. Feedback      | "Ajusta tu diseño"      | Diseño entregado         | Clic en una zona del diseño + instrucción            | Zona regenerada, resto intacto (ve si la iteración es gratis)             |
| 5. Add-ons       | "Comparte y compra"     | Diseño aprobado          | Abre sala de votación o explora el marketplace       | Sala compartible / productos sobre el diseño                              |

## Flujo de auth (previo al canvas)

```
Entrada
 ├─ OAuth Google / Meta ── (sin captcha) ── sesión
 └─ Email
     ├─ Contraseña ── [widget Turnstile] ── verificación email ── sesión
     └─ Código (OTP) ── [widget Turnstile] ── código al email ── sesión
Social sin email verificado → "Verifica tu email para empezar" (OTP) antes de usar cupo gratis.
```

## Transiciones de estado (stepper)

El topbar muestra un indicador de progreso 1→5 con lenguaje de producto
("Sube", "Cuéntanos", "Diseños", "Ajusta", "Comparte"). El paso activo se
resalta; los completados quedan marcados; los futuros, atenuados.

## Estados transversales

- **Coste antes de actuar:** antes de generar/iterar, el usuario ve si es
  **GRATIS** (cupo de bienvenida / iteraciones incluidas) o "~N créditos".
- **Sin saldo:** mensaje claro + CTA a recargar, sin bloquear la navegación.
- **IA no disponible:** toast con reintento; el trabajo previo no se pierde.
