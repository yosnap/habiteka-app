# Red Team — UX / Producto / Adopción · Habiteka

> Vector adversarial usuario frustrado + inversor escéptico. Solo análisis.

## Por qué fracasa con usuarios

- **[CRÍTICO] La calidad del entregable —el valor entero— no está validada.** Todo el plan (18 fases, créditos, Polar, add-ons, back-office) se construye antes de demostrar que el render/plano generado es bueno. El proveedor de imagen sigue sin decidir (§9.1, F3). Si el render es feo/irreal o el plano impreciso, todo el esfuerzo se cae. No hay spike de validación de calidad como gate previo a M2. → F3/F5/F7.
- **[CRÍTICO] Pago por intento en proceso impredecible → ira + reembolsos.** El usuario itera el feedback N veces, cada `inpaint` cobra créditos (F7/F8), resultado de IA impredecible. Pagar por adelantado por "un dado que sale mal" genera churn y chargebacks. El `cost-preview` (F6) informa pero no resuelve el modelo de pricing hostil. → F7/F8/F6.
- **[CRÍTICO] Detección de visión sobre boceto a mano alzada fallará a menudo.** Detectar muros/ventanas de un dibujo a mano es muy duro. El paso "confirma detección" (F5) protege coste, pero si la detección casi siempre está mal, se convierte en una sesión de corrección manual que mata la promesa de magia. → F5.
- **[ALTO] Espera + spinner + coste = abandono tras pagar.** Visión + chat + generación 3D tardan 30-60s. El B2C casual mira un spinner mudo tras haber pagado. F1 (skeleton/progress) no cubre wait largo post-cobro. → F5/F6.
- **[ALTO] Lienzo en blanco + 5 fases + 2 disclaimers legales = parálisis + desconfianza.** No-técnico no sabe qué hacer Y el producto le dice por ley "no te fíes del resultado". El disclaimer obligatorio mina la confianza B2C justo al venderle que sirve. → F1/F4.

## Supuestos de producto NO validados

1. El render/plano será suficientemente bueno para pagar (apuesta central, aplazada §9.1).
2. El usuario aceptará pagar por intento (sin testear disposición a pagar ni tolerancia a fallos).
3. La detección de visión sobre bocetos será fiable (punto técnicamente frágil).
4. Alguien pidió votación comunitaria y marketplace (F9/F10 = solución buscando problema).
5. Mismo producto sirve a B2B (precisión certificable, que el disclaimer niega) y B2C (magia barata) — riesgo de no servir bien a ninguno.
6. Existe diferenciación frente a herramientas de interiorismo IA existentes (el plan no nombra competidores ni ventaja).
7. El back-office completo (F15-F18) es MVP (YAGNI masivo si el core no se valida).

## Recomendaciones accionables

1. **[Máxima prioridad] Gate de calidad antes de M2.** Spike: 15-20 renders/planos reales con FLUX vs Nano Banana vs Imagen sobre bocetos/fotos reales, evaluar con usuarios objetivo. Go/no-go: ≥X% de outputs que un B2C pagaría. Si no pasa, no se construye el resto.
2. **Rediseñar pricing antes de F8.** Primer render gratis / "no te gusta, no se cobra" en N iteraciones / cobrar por resultado aprobado, no por intento. Validar disposición a pagar con landing+waitlist.
3. **Recortar add-ons (F9/F10) y back-office a lo mínimo (F15 básico).** Liberar al equipo para clavar el core.
4. **Onboarding + plantillas como feature P0 de activación** (no wireframe). Plantillas por tipo de espacio reducen dependencia del boceto a mano alzada.
5. **Decidir B2B o B2C para el MVP** (no ambos). Ajustar tono del disclaimer y flujo al segmento.
6. **UX de espera post-pago:** tiempo estimado, progreso real, preview parcial. Nunca spinner mudo tras cobrar.

## Preguntas sin resolver

- ¿Usuario primario del MVP: B2B o B2C? ¿Hay muestras de output de IA que demuestren calidad? ¿Competidores y diferenciación? ¿Disposición a pagar medida?
