# F1 — Design System & UX (Rol UX/Diseño)

## Context Links
- Arquitectura: [docs/system-architecture.md](../../docs/system-architecture.md)
- Flujo agente: [docs/canva-flow.md](../../docs/canva-flow.md)
- Plan general: [plan.md](plan.md)

## Overview
- **Rol primario:** UX/Diseño
- **Prioridad:** P1
- **Estado:** Completado (PR #10)
- **Depende de:** F0 (setup, Tailwind v4 + shadcn instalados)
- **Paralela con:** F2, F3, F11
- **Descripción:** Define flujos de las 5 fases, wireframes conceptuales, design system (tokens, tipografía, color), componentes base, estados (carga/error/vacío), ubicación de disclaimers legales y accesibilidad. Entrega specs en `docs/ux/**` y tokens reales en `src/styles/**`. No implementa lógica de negocio.

## Key Insights
- Disclaimer legal de Fase 1 y sello en entregables son **obligatorios** (sección 4 arquitectura). Su ubicación se diseña aquí, su render en F4/F6.
- **Segmento primario del MVP = B2C** (cliente final / inquilino, no técnico). El flujo, el tono y el onboarding se optimizan para B2C. El onboarding **comercial B2B es post-MVP**: el design system y el modelo de datos lo soportan (mismo sistema, `organizationId` multi-tenant intacto), pero la EXPERIENCIA B2B no se diseña en este MVP.
- **Disclaimer "conceptual" presentado para generar confianza, no miedo:** el B2C no técnico necesita entender que el render es una guía conceptual sin que el aviso lo asuste; tono claro, cercano y tranquilizador (no jurídico-alarmista).
- El canvas domina la pantalla; chat y entregables son paneles laterales colapsables → layout de 3 zonas.
- **Onboarding del canvas:** el lienzo en blanco causa parálisis → ofrecer plantillas/ejemplos de arranque y un estado vacío guiado (no un canvas desnudo).
- **Affordance de feedback por zona:** la edición selectiva no es descubrible sola → hover-highlight de zonas + hint ("haz clic en una pared para modificarla").
- **Equilibrio de disclaimers:** legales y transparentes, pero presentados para **generar confianza** en el B2C no técnico (tono claro y tranquilizador, no alarmista; el aviso "conceptual" informa sin asustar ni bloquear el flujo).
- **Sin jerga interna de fases en la UI:** el usuario no ve "Fase 3"/"Ingesta"; usar lenguaje de producto ("Sube tu plano", "Define tu estilo", "Tus diseños").
- Tailwind v4 usa configuración CSS-first (`@theme` en CSS, no `tailwind.config.js`). Tokens viven en `src/styles/`.

## Requirements
**Funcionales**
- Flujo completo de las 5 fases con transiciones de estado visibles (stepper/indicador de fase).
- Wireframes: ingesta/carga, chat de cualificación, panel de entregables, selección de zona (feedback), add-ons (votación + marketplace).
- Design system: paleta, tipografía, espaciado, radios, sombras, tokens de estado.
- Catálogo de componentes base mapeados a shadcn/ui.
- Estados por componente: loading (skeleton), error, vacío, deshabilitado.
- **Onboarding del canvas:** plantillas/ejemplos de arranque + estado vacío guiado (anti-parálisis del lienzo en blanco).
- **Affordance de feedback por zona:** hover-highlight + hint ("haz clic en una pared") para descubrir la edición selectiva.
- Copy de producto sin jerga de fases (mapear las 5 fases internas a lenguaje de usuario).
- Specs de los 2 disclaimers legales: posición, contraste, persistencia, no-dismissible, **tono que genera confianza** (transparente y tranquilizador para el B2C no técnico; el "conceptual" informa sin asustar).
- Onboarding y copy optimizados para **B2C** (cliente final no técnico) como segmento primario; el flujo B2B comercial queda fuera del MVP.
- **Auth UI (3 métodos):** botones OAuth Google + Meta + formulario email (password o código OTP). El formulario **no-OAuth muestra el widget Turnstile**; los botones OAuth **no** lo muestran. Estados de OTP (envío de código, reintento, código incorrecto/expirado) y mensaje cuando social sin email verificado debe completar verificación antes de usar cupo gratis.

**No funcionales**
- WCAG 2.2 AA: contraste ≥ 4.5:1, foco visible, navegación por teclado, roles ARIA.
- Responsive: desktop-first (canvas), degradación táctil para tablet.
- Tokens consumibles por shadcn vía variables CSS (no hardcode de hex en componentes).

## Architecture
**Layout app (3 zonas):**
```
┌────────────────────────────────────────────────────────┐
│ Topbar: logo · stepper(1-2-3-4-5) · créditos · usuario  │
├──────────┬───────────────────────────────┬─────────────┤
│ Chat /   │                               │ Entregables │
│ Cualific.│         CANVAS (Konva)        │ + Add-ons   │
│ (panel   │   imagen origen + capas       │ (panel      │
│  izq.)   │                               │  der.)      │
├──────────┴───────────────────────────────┴─────────────┤
│ Disclaimer legal (Fase 1, base, no-dismissible)         │
└────────────────────────────────────────────────────────┘
```
**Wireframe ingesta (Fase 1):**
```
[ Arrastra imagen / dibuja in-app / sube plano ]
   ( dropzone grande, estado vacío + CTA )
   ─ análisis visual en curso… (skeleton + progress)
[⚖ Disclaimer conceptual — barra inferior fija]
```
**Sello en entregable (Fase 3):** marca de agua inferior, opacidad media, presente en export PNG/PDF. Spec aquí; render en F6.

**Flujo de tokens (data flow):**
`docs/ux/design-tokens.md` (fuente de verdad) → `src/styles/tokens.css` (`@theme`) → componentes shadcn → UI. Cambio de token = un solo punto de edición (DRY).

## Related Code Files
**Crear (owner UX):**
- `docs/ux/user-flows.md` — flujos de las 5 fases + diagramas
- `docs/ux/wireframes.md` — wireframes ASCII/descripción por pantalla
- `docs/ux/design-system.md` — paleta, tipografía, espaciado, componentes, estados
- `docs/ux/legal-disclaimers.md` — specs de ubicación/persistencia + tono equilibrado de ambos disclaimers
- `docs/ux/canvas-onboarding.md` — plantillas/ejemplos de arranque + affordance de feedback por zona + copy sin jerga de fases
- `docs/ux/accessibility.md` — checklist WCAG 2.2 AA del MVP
- `src/styles/tokens.css` — `@theme` Tailwind v4 (color, fuente, espaciado, radios)
- `src/styles/globals.css` — reset, base, import de tokens (si F0 no lo creó; coordinar con ARQ)

**Modificar:** ninguno fuera de los globs owner (`docs/ux/**`, `src/styles/**`).
**Sin solape:** componentes React los implementa FE (F4/F6); aquí solo specs + tokens CSS.

## Implementation Steps
1. Mapear los 5 user flows (entrada/acción/salida por fase) en `user-flows.md`.
2. Wireframes ASCII por pantalla en `wireframes.md` (ingesta, chat, entregables, feedback-zona, add-ons).
3. Definir tokens (color base + estados, tipografía, escala de espaciado 4px, radios, sombras) en `design-system.md`.
4. Traducir tokens a `src/styles/tokens.css` con `@theme` de Tailwind v4 + variables para shadcn.
5. Catalogar componentes base → equivalente shadcn (Button, Dialog, Tabs, Card, Toast, Skeleton, Tooltip, Sheet).
6. Definir estados loading/error/vacío/deshabilitado por componente clave (canvas, chat, entregables).
7. Specs de disclaimers en `legal-disclaimers.md`: barra inferior fija no-dismissible; sello entregable marca inferior persistente en export; **tono equilibrado** (transparente sin alarmar al B2C).
8. `canvas-onboarding.md`: plantillas/ejemplos de arranque, estado vacío guiado, affordance de feedback por zona (hover-highlight + hint), y mapa de copy fase-interna→lenguaje de producto (sin "Fase N").
9. Checklist accesibilidad WCAG 2.2 AA en `accessibility.md` (contraste, foco, teclado, ARIA, motion-reduce).

## Todo List
- [x] User flows de las 5 fases documentados
- [x] Wireframes ASCII de 5 pantallas
- [x] Design system (tokens, tipografía, color, espaciado)
- [x] `tokens.css` con `@theme` Tailwind v4 funcional
- [x] Catálogo de componentes base → shadcn
- [x] Estados loading/error/vacío definidos
- [x] Onboarding del canvas (plantillas/ejemplos + estado vacío guiado)
- [x] Affordance de feedback por zona (hover-highlight + hint)
- [x] Copy de producto sin jerga de fases (mapa fase→lenguaje usuario)
- [x] Specs de ambos disclaimers legales (tono equilibrado B2C)
- [x] Auth UI (spec): OAuth Google+Meta + email (password/OTP); Turnstile solo en formulario no-OAuth; estados OTP/verificación social — render en F4/F6
- [x] Checklist accesibilidad WCAG 2.2 AA

## Success Criteria
- 5 flujos + 5 wireframes revisables sin ambigüedad por FE.
- `tokens.css` importa y compila con Tailwind v4; shadcn consume las variables.
- Cada componente clave tiene 4 estados especificados.
- Ubicación de los 2 disclaimers documentada con contraste y persistencia.
- Checklist AA cubre contraste, foco, teclado, ARIA.

## Risk Assessment
| Riesgo | Prob×Imp | Mitigación |
|---|---|---|
| Tokens divergen de implementación FE | Med×Alto | Tokens en CSS único; FE prohibido hardcodear hex |
| Tailwind v4 config CSS-first poco conocida | Med×Med | Confirmar sintaxis `@theme` con docs-seeker; ejemplo mínimo en F0 |
| Disclaimer legal omitido/dismissible en impl. | Bajo×Alto | Spec marca "no-dismissible + persistente"; QA valida en F12 |
| Parálisis del lienzo en blanco (abandono) | Med×Med | Onboarding con plantillas/ejemplos + estado vacío guiado |
| Edición por zona no descubrible | Med×Med | Affordance visual: hover-highlight + hint contextual |
| Disclaimer alarmista mina confianza B2C | Med×Med | Tono equilibrado: transparente, claro, no alarmista |
| Jerga interna de fases filtrada a la UI | Bajo×Bajo | Mapa de copy fase→lenguaje de producto; sin "Fase N" en pantalla |
| Canvas + 2 paneles no caben en tablet | Med×Med | Paneles colapsables (Sheet); desktop-first declarado |

## Security Considerations
- Disclaimers son requisito legal de la plataforma → no eliminables por UI/usuario.
- Sin manejo de datos sensibles en esta fase (solo specs y CSS estático).
- Sello indeleble debe sobrevivir al export (validar con FE en F6).

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor):
- **Tokens compilan** (unit/Vitest): un test importa `src/styles/tokens.css` (o el módulo que los expone) y verifica que las variables `@theme` clave existen y resuelven; rojo sin tokens, verde al definirlos.
- **Contraste AA** (unit/Vitest): test que calcula el ratio de contraste de los pares texto/fondo del design system y exige ≥4.5:1; rojo si una paleta falla, verde al ajustarla.
- **Disclaimer no-dismissible** (a11y/Playwright, sobre el harness de F6): la barra de disclaimer existe, es visible y no tiene control de cierre; rojo sin spec aplicada.
- **Mock:** ninguno — son tokens/CSS y reglas de accesibilidad, lógica propia. La validación visual real de componentes vive en F4/F6.

## Next Steps
- F4 (FE canvas) consume wireframes + tokens.
- F6 (FE chat/entregables) consume specs de paneles + render de disclaimers/sello.
- Coordinar con ARQ (F0) si `globals.css` ya existe para evitar solape.
