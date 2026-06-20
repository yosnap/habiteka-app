# Accesibilidad — checklist WCAG 2.2 AA (MVP)

> Objetivo del MVP: **WCAG 2.2 nivel AA**. FE implementa; F12 verifica en CI
> (a11y/Playwright). Los tokens ya garantizan el contraste (test de tokens).

## Contraste

- [x] Texto/fondo ≥ **4.5:1** (texto normal) — garantizado por los tokens
  (`tests/styles/design-tokens.test.ts`).
- [ ] Texto grande (≥ 24px o 18.66px bold) ≥ 3:1.
- [ ] Componentes UI y estados de foco ≥ 3:1 contra el adyacente.

## Foco y teclado

- [ ] Foco **visible** en todo elemento interactivo (anillo `brand-500`, no solo
  `outline: none`).
- [ ] Toda acción alcanzable por teclado; orden de tabulación lógico.
- [ ] Trampas de foco gestionadas en `Dialog`/`Sheet` (las da shadcn/Radix).
- [ ] El canvas ofrece alternativa accesible a las acciones de ratón
  (selección de zona también por teclado).

## Semántica / ARIA

- [ ] Roles correctos (`button`, `dialog`, `tablist`…); shadcn/Radix los aporta.
- [ ] Estados anunciados: carga (`aria-busy`), errores (`role="alert"`),
  progreso (`role="progressbar"`).
- [ ] Imágenes con `alt` significativo; el render lleva descripción.
- [ ] El stepper expone el paso actual (`aria-current="step"`).

## Movimiento y preferencias

- [ ] `prefers-reduced-motion`: desactiva transiciones/animaciones no esenciales.
- [ ] Nada depende solo del color (estados acompañados de icono/texto).

## Formularios (auth)

- [ ] Labels asociados; errores con `aria-describedby`.
- [ ] El widget Turnstile no rompe el orden de foco del formulario.
- [ ] Mensajes de OTP (enviado, incorrecto, expirado) anunciados a lector de
  pantalla.
