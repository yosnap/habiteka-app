# Predict — Revisión Producto/Negocio · Plan Habiteka MVP

> Lente: Product Manager / Negocio. Solo análisis, sin cambios de código.
> Veredicto: el plan está bien estructurado técnicamente pero el MVP es demasiado grande para validar la propuesta de valor. Hay scope creep severo y faltan KPIs y validación legal real.

## Huecos

**ALTA**
- **No hay hipótesis de valor a validar ni KPIs instrumentados.** El plan asume que la propuesta (boceto→entregable profesional) funciona y monetiza, pero no define qué métrica decide pivot/persevera (activación, % entregables aprobados, coste IA/entregable, conversión free→pago). Sin esto el MVP no es "mínimo viable", es "v1 completa". Impacto: plan.md (Hitos), falta una fase/sección de analytics. F8 mide `usage` pero no expone funnel de negocio.
- **El MVP mete TODO de golpe (big-bang).** Agente 5 fases + render 3D + inpainting + 2 add-ons + créditos/pagos + licencia fair-code = M1–M4 sin un punto de lanzamiento intermedio. No hay "primer release vendible" antes de F8–F13. Riesgo de 0 feedback de mercado hasta el final. Impacto: plan.md grafo/hitos.
- **Validación del core de IA no está aislada como gate.** La pregunta de mayor riesgo del producto — ¿el agente produce un entregable que un cliente real pagaría? — depende de F5+F7 y de la calidad del proveedor de imagen (decisión abierta §9.1, sin resolver). Si la calidad no llega, todo lo demás (créditos, add-ons, licencia) es esfuerzo perdido. Impacto: F5/F7, §9.1.

**MEDIA**
- **Tarifa de créditos = decisión abierta (§9.3) sin rango ni margen objetivo.** F8 construye toda la maquinaria de débito "por coste medido" pero no define markup, ni precio de paquete, ni umbral free. No se puede validar si el usuario percibe valor sin un PVP hipótesis. Impacto: F8, §9.3.
- **B2B fair-code está cubierto técnicamente (F13) pero no comercialmente.** No hay onboarding B2B, no hay flujo de "obtener licencia comercial", ni pricing B2B, ni diferenciación de planes en F8 más allá de free/premium. El público B2B (arquitectos, admins de fincas) es el de mayor LTV y el plan lo trata como afterthought. Impacto: F8 (plan-features), F13 (docs/licensing).
- **El loop de viralización votación→B2C no está activado.** El PRD vende la votación como "canal de viralización nativo" (admin finca invita vecinos), pero F9 exige login para ver/votar y no hay invitación masiva, ni captura de email, ni CTA de conversión del vecino a usuario B2C. El add-on existe pero no viraliza. Impacto: F9.

**BAJA**
- **Marketplace sin métrica de monetización real.** F10 registra clics pero no hay atribución de conversión/comisión (Amazon Associates no da postback fiable). El "revenue" del add-on es no medible en MVP → su valor es de UX (sugerencias), no de ingresos. Debe venderse internamente como tal, no como línea de negocio. Impacto: F10.

## Riesgos
- **Legal/RGPD insuficiente para UE.** Hay disclaimers de "diseño conceptual" (bien) pero NO hay: base legal de tratamiento, consentimiento, política de privacidad, DPA con OpenRouter/proveedor imagen (datos = fotos de viviendas de personas), ni retención. Subir fotos de interiores reales es dato personal. F13 cubre licencia de software, no protección de datos. Riesgo regulatorio real en UE. Impacto: falta fase RGPD; F2/F8.
- **Responsabilidad sobre diseños estructurales.** Un usuario podría ejecutar una reforma estructural sobre un "render conceptual". El sello legal mitiga parcialmente, pero conviene bloquear/avisar explícito en reformas estructurales (no solo decorativas). Riesgo de responsabilidad civil. Impacto: F5 (Fase 1 ingesta), disclaimers.
- **Coste IA puede hacer inviable el unit economics.** Render 3D + inpainting + visión por entregable es caro. Si el coste medido > lo que el usuario paga en créditos, cada uso pierde dinero. No hay análisis de coste/entregable antes de fijar tarifa. Impacto: F7/F8, §9.1/§9.3.
- **Dependencia de proveedor de imagen sin decidir (§9.1) bloquea la validación de calidad** y el cálculo de coste. Es el mayor riesgo técnico-de-producto y está marcado "abierto". Impacto: F3/F7.

## Mejoras
- **Cortar el MVP a un "Walking Skeleton vendible":** F0–F6 (canvas + agente + 1 entregable: render 3D O plano 2D, no ambos) + F8 créditos básicos. **Diferir a v1.1:** inpainting/feedback por zona (F7), votación (F9), marketplace (F10). Esto da time-to-market y feedback real antes de invertir en add-ons. KISS/YAGNI.
- **Añadir fase "Validación de valor + Analytics"** antes de los add-ons: instrumentar funnel (subida→cualificación→entrega→aprobación→pago), coste/entregable y NPS del entregable. Decidir add-ons con datos.
- **Definir hipótesis de pricing explícita** (ej. paquete N créditos = X€, 1 entregable = Y créditos, free = 1 entregable de prueba) aunque sea provisional, para poder medir conversión desde el día 1.
- **Activar la viralización votación:** permitir ver la sala sin login (solo votar requiere login ligero), capturar email del vecino, y CTA "diseña tu propia reforma" → embudo B2C. Es el activo de crecimiento más barato del plan.
- **Añadir mini-fase RGPD/legal** (privacidad, consentimiento de subida de imágenes, DPA proveedores, retención) — bloqueante para lanzar en UE.
- **Posicionar marketplace como feature de UX, no de ingresos** en MVP; mover la afiliación a "experimento de monetización" post-validación.

## Preguntas abiertas
1. ¿Cuál es la UNA métrica de éxito del MVP que decide seguir/pivotar? (sin ella no hay "viable")
2. ¿Cuál es el coste real estimado por entregable (render 3D + visión + inpaint) y el markup objetivo? ¿Hay unit economics positivo?
3. ¿El público prioritario es B2B (arquitectos/admins fincas, mayor LTV) o B2C? El plan los trata por igual; ¿se puede enfocar uno primero?
4. ¿Se ha validado con usuarios reales que un "entregable conceptual" tiene valor de pago, antes de construir créditos/pagos?
5. ¿Hay cobertura legal RGPD para subir fotos de viviendas? ¿DPA firmado con OpenRouter/proveedor imagen?
6. ¿Por qué render 3D + inpainting están en MVP "por decisión usuario" si duplican el riesgo técnico antes de validar el core?

**Status:** DONE
