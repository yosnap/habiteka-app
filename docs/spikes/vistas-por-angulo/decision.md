# Decisión GO/NO-GO — Fidelidad del render por ángulo de vista (F2)

Gate del roadmap antes de implementar F2 completa. Se rellena tras ejecutar el arnés
`tests/spikes/vistas-por-angulo.spike.ts` con claves reales.

## Cómo obtener la evidencia

```bash
# Claves reales en .env.local (gitignored), nunca en CI ni cliente:
#   OPENROUTER_API_KEY=<tu-key>
set -a; . ./.env.local; set +a
npx tsx tests/spikes/vistas-por-angulo.spike.ts
```

Genera, para el mismo plano de ejemplo, un PNG por ángulo en `tests/spikes/out-vista-*.png`
más la referencia `out-vista-referencia.png`. Los PNG son evidencia local; NO se commitean.

## Criterio (rúbrica mínima)

Por cada ángulo, comparar el render contra la referencia y juzgar:

- **Disposición:** ¿cada elemento (sofá, mesa, TV, ventana) está contra la misma pared y en la
  misma zona relativa que en el plano?
- **Proporción:** ¿la forma de la sala se respeta?
- **Coherencia del ángulo:** ¿la cámara es realmente la pedida (no siempre cenital)?

Umbral sugerido: un ángulo es **GO** si respeta disposición y pared de la mayoría de elementos
sin reordenarlos. **NO-GO** si inventa la distribución o ignora la cámara.

## Veredicto por ángulo (ejecutado 2026-06-21, proveedor Nano Banana)

| Ángulo          | ¿Respeta disposición?      | ¿Cámara correcta? | GO/NO-GO | Notas |
|-----------------|----------------------------|-------------------|----------|-------|
| cenital         | Sí (posición), NO (tamaño) | Sí                | **GO**   | Ubicaciones correctas; la ventana sale más pequeña que en el plano → problema de TAMAÑO (escala), no de ángulo. |
| desde-puerta    | No                         | Parcial           | **NO-GO**| La puerta debería estar detrás del sofá; muestra la TV a la izquierda del sofá. No corresponde. |
| panorámica      | No                         | Sí (gran angular) | **NO-GO**| Inventa una ventana extra a la izquierda; puerta mal ubicada. El espacio extra detrás es tolerable en panorámica, pero la disposición falla. |
| ojo-de-pájaro   | No                         | Sí (3/4)          | **NO-GO**| Puerta a la izquierda, ventana al frente, TV a la izquierda. No corresponde. |

## Decisión final

**GO solo para `cenital`. NO-GO para desde-puerta, panorámica y ojo-de-pájaro** con el enfoque
actual (referenceImage CENITAL + prompt que pide otra cámara).

**Causa raíz:** una referencia cenital no aporta la 3ª dimensión ni la perspectiva; al pedir un
ángulo no cenital el modelo debe inventar profundidad y alucina la disposición (mueve puerta/TV,
añade ventanas). No es un fallo del prompt sino del enfoque "una imagen 2D cenital → vista 3D
arbitraria".

**Hallazgo separado (TAMAÑO):** incluso en cenital, los tamaños no se respetan (ventana pequeña).
F0 metió las medidas reales en el prompt de TEXTO, pero el modelo no las honra de forma fiable.
Es un problema transversal de realismo/escala, NO del ángulo → no se resuelve en F2.

**Defecto del caso de prueba:** la referencia cenital de `EXAMPLE_SALON` coloca la puerta "detrás
del sofá" de forma poco natural. Conviene un caso de ejemplo mejor diseñado antes de re-medir.

**Implicación para F2:** la primera entrega de F2 NO añade vistas no cenitales por imagen. Las
opciones para vistas reales en 3D (cámara libre, navegable) recaen en F6 (Three.js/R3F), que ya
estaba previsto como pista propia. Ver siguiente sección.

## 2ª iteración (2026-06-21) — caso de ejemplo coherente + refuerzo de tamaño

Tras rediseñar `EXAMPLE_SALON` (disposición coherente: puerta en pared izquierda, TV en el fondo,
sofá enfrentado) y añadir escala + instrucción explícita de respetar tamaños en el prompt:

| Ángulo        | Resultado 2ª iteración |
|---------------|------------------------|
| cenital       | ✅ **Tamaños correctos** ahora (ventana proporcionada). El hallazgo de TAMAÑO queda RESUELTO. |
| desde-puerta  | ❌ Sigue mal: muestra la puerta de frente (deberíamos mirar DESDE la puerta), ventana movida. |
| panorámica    | ❌ Puerta en la pared de la TV; inventa una 2ª ventana a la derecha. |
| ojo-de-pájaro | ❌ Resultado casi idéntico a "desde la puerta", incoherente. |

**Conclusión reforzada:** los ángulos no cenitales fallan AUNQUE el plano de entrada sea coherente
→ NO es problema del caso de ejemplo ni del prompt, es el límite del enfoque "referencia cenital
2D → vista 3D arbitraria". El modelo no tiene la profundidad para reubicar la cámara. Dado que dos
iteraciones independientes dan el mismo NO-GO, **no se justifica seguir probando variantes de
prompt/disposición** con este enfoque. Una vista navegable real necesita geometría 3D (F6), no un
modelo de imagen 2D.

**Ganancia neta del spike:** quedó resuelto el realismo de TAMAÑO en cenital (escala F0 → prompt),
que es una mejora transversal aprovechable ya por el flujo de render actual (CRL-4).

## 3ª iteración (2026-06-21) — otros modelos por OpenRouter

FLUX NO está disponible por API en la cuenta OpenRouter (404; solo Gemini 2.5/3/3.1 y GPT-image).
Se probó el más potente disponible, **Gemini 3 Pro Image** (`google/gemini-3-pro-image`):

| Ángulo        | Resultado Gemini 3 Pro |
|---------------|------------------------|
| cenital       | ✅ Excelente: disposición y tamaños correctos; incluso ROTULÓ las cotas (5.2m, 3.7m, 90cm, 1.4m, 2m, 40cm) sobre la imagen. |
| desde-puerta  | ❌ Sigue sin corresponder con el plano. |
| panorámica    | ❌ Sigue sin corresponder. |
| ojo-de-pájaro | ❌ Sigue sin corresponder. |

**Conclusión definitiva (3 modelos, 4 iteraciones):** el fallo de los ángulos no cenitales es del
ENFOQUE, no del modelo ni del prompt. Una referencia 2D cenital no contiene la profundidad; al
pedir otra cámara, cualquier modelo de imagen debe inventar la geometría y aluciona. Es un límite
de la categoría "imagen 2D → otra cámara", no de un proveedor concreto.

## DECISIÓN: F2 cerrada NO-GO. Las vistas navegables son F6 (3D real)

- **F2 (vistas no cenitales por imagen): NO-GO definitivo.** No se implementa con modelo de imagen.
- **La necesidad de negocio (vistas navegables) recae en F6 (Three.js/R3F):** ahí el plano + la
  escala (F0) construyen una ESCENA 3D real; la cámara se mueve por geometría, no por adivinación.
  Es el único enfoque que da vistas fieles desde cualquier ángulo. F6 ya estaba previsto como
  pista propia (XL, con su /ck:plan + /ck:research).
- **Ganancias que SÍ se conservan de este trabajo:**
  1. Render cenital con TAMAÑOS correctos (escala F0 → prompt reforzado). Mejora CRL-4 ya.
  2. `EXAMPLE_SALON` con disposición coherente + escala.
  3. Provider de imagen con modelo inyectable (habilita probar/migrar modelos por config).
  4. Arnés de spike multi-modelo reutilizable para re-medir cuando cambie el stack.
- **Re-medir en el futuro:** si aparece un modelo de imagen con entrada 3D/multivista real, el
  arnés permite reevaluar sin reescribir.
