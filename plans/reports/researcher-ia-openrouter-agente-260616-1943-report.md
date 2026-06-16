# Research: OpenRouter IA Layer Architecture para Habiteka

## 1. OpenRouter Integration Architecture (RECOMENDADO)

**Enfoque**: SDK OpenAI-compatible con server-side API key management + fallback automático.
- **Cliente**: `openai` Python/Node.js SDK apuntando a `api.openrouter.ai`
- **API Key**: server-side, en env seguro; cliente web nunca lo ve
- **Fallback**: OpenRouter maneja automáticamente failover entre modelos del mismo tier
- **Session ID**: usa `openrouter-session-id` header para cachear contextos multi-turn

**Trade-off**: OpenRouter cobra +5.5% markup + $0.80 mínimo. Beneficio: NO integras con 10+ APIs directas.

## 2. Modelos Vision para Fase 1 (Ingesta + análisis planos)

**Recomendado**: Claude 3.5 Sonnet o GPT-4o Vision (ambos en OpenRouter)
- Claude 3.5: mejor reasoning sobre planos técnicos, detecta muros/ventanas/puertas
- GPT-4o: mejor OCR de cotas/textos en planos digitalizados
- Fallback: Qwen3.5 Vision (económico, 93% accuracy en análisis)
- **Coste**: ~$0.03-0.10 por análisis (imagen 2MP)

**NO usar**: Google Gemini Vision (no accesible directo en OpenRouter actualmente).

## 3. Generación Imagen / Renders (Fase 3 + Feedback)

**Problema**: OpenRouter NO incluye modelos de generación de imagen (solo chat/vision).
**Solución**: Ruta paralela complementaria a OpenRouter
- **Renders 3D fotorrealistas**: Nano Banana 2 (Gemini Flash Image) vía Google AI Studio o Nano Banana proxy
  - 40.7% traffic share, costo $0.01/imagen 512x512
  - Mejor quality vs coste para diseños conceptuales
- **Inpainting (Fase 4)**: FLUX.1 Kontext vía fal.ai o Replicate
  - Edición localizada por máscara + prompt ("mueve ventana 50cm derecha")
  - Coste: $0.02-0.05 por edit

**Arquitectura**: Agent orquesta Vision (OpenRouter) → ChatCompletion tools → Image Gen (Nano Banana/FLUX en paralelo)

## 4. Generación Planos 2D Acotados (Fase 3)

**Enfoque RECOMENDADO**: JSON Estructurado + render en canvas, NO generación de imagen.
- Claude 3.5 con `response_format: "json_schema"` → salida: `{walls: [{x, y, width, height}], doors: [...], windows: [...], annotations: [...]}`
- Canvas React renderiza JSON con SVG/Canvas nativo (control total, editable)
- Ventaja: determinístico, versionable, no regenera cada vez

**Alternativa rechazada**: image generation de plano (costoso, opaco, difícil de editar selectivamente).

## 5. Arquitectura del Agente Intérprete (5 Fases)

```
State = {phase, imageBase64, userParams, chatHistory, designJson, selectedZone}

1. INGESTA: image upload → Claude Vision analyzes → extract structural elements
2. CUALIFICACIÓN: ChatCompletion loop (tools: validateStructure, setStyle, selectDeliverables)
3. ENTREGA: Claude + JSON schema → {design, materials, specs} → render canvas
4. FEEDBACK: user selects zone → system prompt "edit only {zone}" → FLUX inpaint or regen subset
5. ADD-ONS: (delegado a otro investigador)

Persistencia: {design, imageBase64, chatHistory} en DB/session con ID generación única.
Tool-calling: Soportado natively por OpenRouter (Claude/GPT) vía `/chat/completions`.
```

**Pattern**: Enrique Armenta's "Perception → Reasoning → Action → Observation" con ConversationBufferMemory (últimos 10 turnos).

## 6. Coste por Entregable (MVP, estimaciones)

| Entregable | Tokens aprox | Coste OpenRouter | Coste Imagen |
|-----------|----------|------------------|--------------|
| Análisis plano | 2k in, 500 out | $0.01 | — |
| Chat cualificación | 5k in, 2k out | $0.03 | — |
| Plano 2D JSON | 3k in, 1.5k out | $0.02 | — |
| Render 3D fotorrealista | — | — | $0.01-0.05 |
| **Total entregable mínimo** | | **$0.06** | **$0.01-0.05** |
| **Total con inpaint ×3 iterations** | | **$0.06** | **$0.08-0.15** |

**Modelo negocio**: cobrar $15-40 por entregable, mágen ~50-70% tras gastos servidor.

## 7. Tech Stack Recomendado (resumen ejecutivo)

| Componente | Tech | Motivo |
|-----------|------|---------|
| Chat + Vision | OpenRouter Claude 3.5 | visión + reasoning combinado |
| Fallback | Qwen Vision | económico, redundancia |
| Planos 2D | JSON schema + Canvas React | control, no opaco |
| Renders 3D | Nano Banana 2 vía Nano Banana proxy | costo mínimo, quality aceptable |
| Inpainting | FLUX.1 Kontext vía fal.ai | edición localizada robusto |
| Estado agent | Supabase/PG sesiones + JSON column | persistencia light-weight |
| Streaming | OpenRouter SSE + React Server Sent Events | multi-turn fluido |

## Unresolved Questions

1. ¿Qué plataforma proxy para Nano Banana (fal.ai vs Replicate vs Nano Banana directo)? Requiere benchmarking latencia + precios.
2. ¿Flujo de inpainting iterativo en Fase 4: regenerar zona completa vs editar máscara + blend? UX trade-off.
3. ¿Cómo encodificar "recuadro seleccionado" en prompt para Claude sin perder precisión? Requiere test con planos reales.
4. ¿Timeout máximo aceptable para renders 3D en UX? (Nano Banana ~5-10s, FLUX ~15-30s).
5. ¿Guardar histórico de generaciones (A/B testing) o descartar post-feedback? Storage vs feature.

---
**Status:** DONE  
**Reporte:** `/Volumes/EVO990/Proyectos/CodeIA Academy Projects/habiteka/habiteka-app/plans/reports/researcher-ia-openrouter-agente-260616-1943-report.md`
