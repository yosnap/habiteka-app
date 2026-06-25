# User Flows — Habiteka (5 fases del agente)

> El usuario **nunca ve** los nombres internos de fase. La columna "Fase interna"
> es solo para el equipo; el "Lenguaje de producto" es lo que ve el usuario.

| Fase interna | Lenguaje de producto | Entrada | Acción del usuario | Salida visible |
|---|---|---|---|---|
| 1. Ingesta | "Sube tu espacio" | Imagen/dibujo/plano | Arrastra imagen, dibuja in-app o sube plano | Análisis visual (skeleton) → elementos detectados + disclaimer conceptual |
| 2. Cualificación | "Cuéntanos qué quieres" | Diálogo | Responde el chat (objetivo, estilo, qué entregables) | Resumen de preferencias confirmable |
| 3. Entrega | "Tus diseños" | Preferencias confirmadas | Pulsa "Generar" (ve coste: GRATIS o ~N créditos) | Plano 2D acotado, render 3D y/o memoria, con sello legal |
| 4. Feedback | "Ajusta tu diseño" | Diseño entregado | Clic en una zona del diseño + instrucción | Zona regenerada, resto intacto (ve si la iteración es gratis) |
| 5. Add-ons | "Comparte y compra" | Diseño aprobado | Abre sala de votación o explora el marketplace | Sala compartible / productos sobre el diseño |

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
