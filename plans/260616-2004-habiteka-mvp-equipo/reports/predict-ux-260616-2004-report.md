# Predict — Revisión UX de Habiteka MVP

> Lente: experiencia de usuario B2C no técnico. Plan revisado: phase-00..13, foco F1/F4/F6/F7/F9/F10. Solo análisis, sin cambios.

## Huecos

### Alta
- **Estimación de créditos pre-gasto ausente.** F8 debita por *coste medido* DESPUÉS de generar (cost-to-credits post-`ProviderCost`). El usuario aprueba un entregable/iteración sin saber cuánto costará → ansiedad y disputas. Falta "esto costará ~N créditos, confirmar". Impacto: **F8 + F6** (gating muestra saldo pero no preview de coste por acción).
- **Onboarding/primer uso del canvas no existe como entregable.** F1 lista wireframe de ingesta (dropzone) pero ningún plan cubre plantillas, ejemplos, tour, o "qué dibujar" para usuario sin plano. Canvas en blanco = parálisis. Impacto: **F1 (spec) + F4 (impl)**.
- **Manejo de error/malinterpretación de IA cara al usuario, sin diseño.** Fase 1 (visión) puede leer mal los trazos; F5/F6 mencionan estados "error" genéricos y reintento de `advance`, pero no QUÉ ve el usuario si el agente confunde una pared con una ventana, ni cómo corrige ANTES de gastar en Entrega. No hay paso "confirma lo que detecté". Impacto: **F5 (salida Ingesta) + F6 (UI)**.

### Media
- **Espera de generación 3D sin contrato de progreso real.** F1 cita "skeleton + progress", pero render 3D/inpainting tardan 10-60s+ sin progreso determinista. Skeleton estático no fija expectativa; falta tiempo estimado, posibilidad de cancelar, y feedback de fase larga. Impacto: **F1/F6/F7**.
- **Descubribilidad del feedback por zona (Fase 4).** F4/F7 implementan selección de zona (marquesina/click→chat contextual) pero nada indica al usuario que el diseño es editable por zona. Sin affordance visual (hover highlight, hint "haz clic en una pared"), la feature potente queda oculta. Impacto: **F1 (spec affordance) + F4/F6**.
- **Add-ons como "pasarela" tras aprobación pueden sentirse pegados.** F9/F10 entran por slot `agent.postEntrega`. Transición de "diseño mío" a "vota la comunidad / compra en Ikea" carece de UX de puente narrativo; riesgo de percibirse como upsell intrusivo. Impacto: **F6 (punto de entrada) + F9/F10**.

### Baja
- **Accesibilidad del canvas limitada a la toolbar.** F1/F4 prometen toolbar navegable por teclado, pero el canvas Konva en sí (dibujar, seleccionar zona) es inaccesible para teclado/lector de pantalla y no hay alternativa declarada (lista textual de elementos detectados, edición por formulario). WCAG AA se cumple solo parcialmente. Impacto: **F1/F4**.

## Riesgos
- **Fricción legal vs confianza.** Disclaimer no-dismissible fijo abajo + sello indeleble en cada entregable son correctos legalmente, pero repetidos y con tono "requiere validación profesional" pueden minar la confianza del B2C ("¿entonces no sirve?"). Riesgo de abandono. Mitigar con copy positivo y jerarquía visual, no solo advertencia. **F1**.
- **Stepper de 5 fases expuesto a usuario no técnico.** El modelo mental "Ingesta/Cualificación/Entrega/Feedback/Add-ons" es jerga interna. Mostrarlo crudo confunde. Riesgo de desorientación. **F1/F6**.
- **Saldo insuficiente a mitad de iteración** (`BillingError(insufficient_credits)`): el usuario refina una zona y se queda sin créditos tras varias iteraciones → frustración si no se avisa antes. **F7/F8**.

## Mejoras
- Añadir paso de **confirmación de detección** entre Fase 1 y 2 ("detecté 3 paredes, 1 ventana — ¿correcto?") con corrección manual barata antes de gastar en Entrega. **F5/F6**.
- **Preview de coste en créditos** en cada CTA generador (Entrega, iteración, render 3D) + saldo restante proyectado. **F6/F8**.
- **Onboarding ligero**: plantillas de espacios comunes (salón, baño, cocina) + ejemplo "antes/después" en estado vacío del canvas. **F1/F4**.
- Reformular stepper a lenguaje humano ("Tu boceto → Tus gustos → Tu propuesta → Ajustes → Extras") y disclaimer con framing de confianza. **F1**.
- Affordance de zona editable (hover highlight + hint contextual) para descubribilidad del feedback. **F4/F6**.

## Preguntas abiertas
1. ¿El usuario puede CANCELAR una generación 3D en curso y recuperar/no gastar créditos? No está definido (F7/F8).
2. ¿Se debita aunque la generación falle o el resultado sea inservible? Política de reembolso de créditos ausente (F8).
3. ¿Hay límite de iteraciones por plan visible al usuario antes de chocar con el gating? (F7 lo menciona como mitigación, F8 no lo expone en UI).
4. ¿El disclaimer/sello aplica también a la votación pública y al export compartido? Coherencia legal en F9 sin confirmar.

**Status:** DONE
