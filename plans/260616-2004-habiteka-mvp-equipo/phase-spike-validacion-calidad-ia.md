# F-S0 — Spike: Validación de calidad del entregable IA (GATE previo a M2)

**Context Links:** [plan.md](plan.md) · adaptadores IA: [phase-03](phase-03-ia-adaptadores.md) · setup/contratos: [phase-00](phase-00-arq-setup-contratos.md) · agente: [phase-05](phase-05-ia-agente-state-machine.md) · feedback/render: [phase-07](phase-07-feedback-render-3d.md)

## Overview
- **Rol primario:** IA + Producto
- **Prioridad:** P1 (**GATE bloqueante: si NO pasa, M2 no arranca**)
- **Estado:** Planificado
- **Depende de:** F0 (contratos, repo), F3 (adaptadores mínimos: `ImageAdapter.generate`/`inpaint` conmutables por env + `ChatVisionAdapter` para visión sobre bocetos)
- **Paralela con:** — (es un spike previo; corre tras F3 y antes de cualquier fase de M2)
- **Descripción:** Validar empíricamente que la **calidad del entregable IA** (render 3D + plano 2D, y la fiabilidad de la detección de visión sobre boceto) es suficiente para que un usuario objetivo pague — ANTES de construir el resto del producto. Cierra la decisión §9.1 (proveedor de imagen) y da luz verde (o no) a M2. Sin este gate, las 18 fases se construyen sobre una apuesta no verificada (el valor central del producto).

## Key Insights
- **El valor entero del producto es la calidad del output.** Todo lo demás (créditos, Polar, add-ons, back-office) es andamiaje. Si el render es feo/irreal o el plano impreciso, el andamiaje no importa. Este es el riesgo nº1 del red team de producto.
- **§9.1 sigue abierta — proveedor NO fijado a priori:** FLUX vs Nano Banana vs Imagen se comparan **de igual a igual**; ningún proveedor se asume ganador antes del spike. F3 deja el adaptador conmutable por `IMAGE_PROVIDER` justamente para probar los **tres** candidatos reales y **decidir con datos** (go/no-go por evidencia), no por intuición.
- **Criterios de calidad explícitos del comparativo:** (1) **realismo del render 3D**, (2) **precisión/fidelidad del plano 2D** (dimensional + fiel al boceto), (3) **calidad del inpainting** para el feedback por zona (edición selectiva limpia, sin artefactos en bordes de máscara — capacidad central de F7), **y** (4) **coste por imagen** + latencia. La decisión pondera calidad **y** coste, no calidad sola.
- **La detección de visión sobre boceto a mano alzada es técnicamente frágil:** detectar muros/ventanas de un dibujo a mano falla a menudo. El spike mide la tasa real de acierto para saber si el paso "confirma detección" (F5) es una mejora de coste o una sesión de corrección manual que mata la promesa.
- **Es un spike, no producción:** código exploratorio, fuera del flujo de usuario. Su entregable es una **decisión documentada** (GO/NO-GO + proveedor elegido), no features.

## Requirements
**Funcionales**
- Generar **15-20 muestras reales** por candidato de proveedor de imagen: render 3D + plano 2D a partir de **bocetos a mano y fotos reales** representativos de los casos de uso (no prompts sintéticos ideales).
- Ejecutar las mismas entradas contra **cada candidato** (FLUX, Nano Banana, Imagen) bajo el adaptador conmutable de F3.
- Medir **fiabilidad de detección de visión** sobre los mismos bocetos (tasa de muros/ventanas/zonas detectados correctamente).
- Evaluar las muestras con **criterios objetivos** por proveedor: **realismo del render 3D**, **fidelidad al boceto + precisión dimensional del plano 2D**, **calidad del inpainting** (feedback por zona: edición selectiva limpia, sin artefactos en bordes de máscara), ausencia de artefactos generales — **y con usuarios objetivo** (¿pagarían por esto?).
- Registrar **coste por imagen y latencia** por candidato (insumo para pricing de F8 y UX de espera de F6); el comparativo pondera **calidad Y coste**.
- Documentar una **decisión go/no-go por evidencia** (umbral cuantitativo de aceptación) y el **proveedor elegido** entre los tres (no fijado a priori).

**No funcionales**
- Resultados reproducibles: entradas, prompts y outputs versionados en `docs/spikes/**`.
- Cero impacto en el código de producción (`src/**`): el spike vive en sus globs propios.
- Llamadas reales a proveedores: con dev-keys, fuera de CI principal (job/ejecución manual aislada).

## Architecture
```
docs/spikes/
  calidad-ia/
    README.md                  # objetivo, protocolo, criterio GO/NO-GO
    inputs/                     # bocetos a mano + fotos reales (anonimizadas)
    samples/                    # outputs por candidato (flux/, nano-banana/, imagen/)
    rubric.md                   # criterios objetivos por proveedor: realismo 3D, precisión plano 2D, calidad inpainting (feedback zona), coste/imagen + escala
    user-eval-results.md        # resultados de evaluación con usuarios objetivo
    decision.md                 # GO/NO-GO por evidencia + proveedor elegido (FLUX|Nano Banana|Imagen) + justificación calidad+coste (cierra §9.1)
tests/spikes/
  vision-detection-accuracy.test.ts  # mide tasa de acierto de detección sobre el set de bocetos
  image-quality-harness.test.ts      # arnés que dispara cada proveedor sobre inputs/ y vuelca a samples/
```
**Data flow:** `inputs/` (bocetos+fotos reales) → arnés dispara `ImageAdapter.generate`/`inpaint` (F3) por cada `IMAGE_PROVIDER` candidato → `samples/<proveedor>/` → evaluación con `rubric.md` + sesión con usuarios → `decision.md` consolida coste/latencia/calidad → **GO/NO-GO** + proveedor → desbloquea (o detiene) M2.
**Data flow (visión):** mismos `inputs/` bocetos → `ChatVisionAdapter` detecta elementos → comparación contra ground-truth anotado → tasa de acierto en `vision-detection-accuracy.test.ts`.

## Related Code Files
**A crear (owner IA + Producto):**
- `docs/spikes/calidad-ia/**` (README, inputs, samples, rubric, user-eval, decision).
- `tests/spikes/vision-detection-accuracy.test.ts`, `tests/spikes/image-quality-harness.test.ts`.
**Owner globs:** `docs/spikes/**`, `tests/spikes/**`.
**Lee/usa (no edita):** `src/server/ai/**` (F3, vía factories `getImageAdapter()`/`getChatVisionAdapter()`); `src/lib/contracts/**` (F0).
**NO tocar:** ningún glob de producción salvo lectura de los adaptadores de F3 vía su interfaz pública.

## Implementation Steps
1. Reunir el set de entradas reales: 15-20 bocetos a mano + fotos representativas; anonimizar (sin EXIF/geo, sin caras) — formato común con `pii-scrub` de F14.
2. Anotar ground-truth de elementos en cada boceto (muros/ventanas/zonas) para medir detección.
3. Escribir `image-quality-harness.test.ts`: itera `IMAGE_PROVIDER` ∈ {flux, nano-banana, imagen}, dispara `generate`/`inpaint` por input, vuelca a `samples/<proveedor>/` + registra coste/latencia.
4. Escribir `vision-detection-accuracy.test.ts`: dispara visión sobre bocetos, compara con ground-truth, reporta tasa de acierto.
5. Redactar `rubric.md` (criterios objetivos) y ejecutar evaluación interna + **sesión con usuarios objetivo**.
6. Consolidar `decision.md`: tabla por candidato (realismo 3D / precisión plano 2D / calidad inpainting / coste por imagen / latencia / detección) → **proveedor elegido entre los tres** (cierra §9.1) + **go/no-go por evidencia** contra el umbral.
7. Comunicar el veredicto al equipo: si GO, M2 arranca con el proveedor fijado en `IMAGE_PROVIDER`; si NO-GO, M2 se detiene y se replantea (pricing/segmento/proveedor).

## Todo List
- [ ] Set de entradas reales (bocetos+fotos) anonimizado
- [ ] Ground-truth anotado para detección de visión
- [ ] `image-quality-harness` (dispara cada proveedor → samples + coste/latencia)
- [ ] `vision-detection-accuracy` (tasa de acierto sobre bocetos)
- [ ] `rubric.md` + evaluación interna
- [ ] Sesión de evaluación con usuarios objetivo
- [ ] `decision.md`: proveedor elegido (§9.1) + GO/NO-GO documentado
- [ ] Veredicto comunicado al equipo (gate a M2)

## Success Criteria
- 15-20 muestras reales generadas por **cada** candidato de proveedor, versionadas en `samples/`.
- Tasa de acierto de detección de visión medida sobre bocetos reales (no sintéticos).
- `decision.md` compara los **tres** proveedores por realismo 3D / precisión plano 2D / calidad inpainting / coste por imagen, con **proveedor elegido** (§9.1 cerrada, no fijado a priori) y **go/no-go por evidencia** cuantitativo aplicado.
- Veredicto explícito: **GO** (M2 arranca) o **NO-GO** (M2 detenido, replanteo) comunicado al equipo.

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Construir 18 fases sobre calidad no validada | Alta | Crítico | Este spike es GATE: M2 no arranca sin GO documentado |
| Detección de visión sobre boceto a mano falla a menudo | Alta | Alto | Medir tasa real; si baja, replantear UX (plantillas en vez de boceto libre) antes de M2 |
| Ningún proveedor alcanza el umbral de calidad | Media | Crítico | NO-GO honesto: detener y replantear (proveedor/pricing/segmento), no construir a ciegas |
| Evaluación sesgada (solo criterio interno, sin usuarios) | Media | Alto | Incluir sesión con usuarios objetivo + rúbrica objetiva, no solo opinión del equipo |
| Muestras con PII (fotos reales) | Media | Alto | Anonimizar entradas (EXIF/geo/caras) con el mismo criterio de `pii-scrub` (F14) |

## Security Considerations
- Fotos reales de entrada anonimizadas antes de enviarse a proveedores (EXIF/geo/caras) — coherente con minimización RGPD (F14).
- Dev-keys de proveedores solo en el entorno del spike, nunca en CI ni en cliente.
- `samples/` no contienen PII; si una muestra revela domicilio/personas, se excluye del repo.

## TDD / Pruebas primero
Spike exploratorio, pero las mediciones se codifican como tests reproducibles (rojo→verde):
- **Arnés de calidad:** `image-quality-harness.test.ts` falla si un candidato no produce output para todas las entradas (asegura cobertura completa del set antes de evaluar).
- **Detección de visión:** `vision-detection-accuracy.test.ts` reporta tasa de acierto vs ground-truth; el test fija un umbral mínimo discutible (rojo si por debajo → señal de NO-GO o replanteo de UX).
- **Mock:** ninguno en el arnés — son llamadas **reales** a proveedores con dev-keys (es el punto del spike). Corren en ejecución aislada/manual, **nunca en CI principal**.

## Next Steps
- **GO** → M2 arranca con `IMAGE_PROVIDER` fijado; el resto de F3 (proveedor activo + stubs) se cierra con el ganador.
- **NO-GO** → detener M2; replantear con Producto (proveedor, pricing por resultado vs por intento, segmento B2B/B2C).
- Alimenta a F8 (coste real → pricing) y a F6 (latencia real → UX de espera post-pago).
