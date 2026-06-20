# Rúbrica de evaluación — calidad del entregable IA

Criterios objetivos para puntuar cada candidato sobre el mismo set de entradas.
Cada criterio se puntúa **1–5** (1 = inservible, 5 = listo para vender). El
**umbral GO** es un mínimo por criterio **y** una media ponderada — fíjalos antes
de mirar resultados para no racionalizar a posteriori.

## Criterios y peso

| # | Criterio | Qué se mira | Peso |
|---|---|---|---|
| 1 | **Realismo del render 3D** | Materiales, luz, proporciones creíbles; sin "aspecto IA" obvio | 30% |
| 2 | **Fidelidad + precisión del plano 2D** | Fiel al boceto; proporciones/dimensiones coherentes; legible | 25% |
| 3 | **Calidad del inpainting** | Edición selectiva limpia; sin artefactos en bordes de máscara | 20% |
| 4 | **Ausencia de artefactos generales** | Sin deformaciones, texto basura, elementos imposibles | 10% |
| 5 | **Coste por imagen** | USD/imagen (menor = mejor; normalizar a 1–5) | 10% |
| 6 | **Latencia** | Segundos hasta el resultado (impacta UX de espera, F6) | 5% |

**Puntuación ponderada** = Σ (nota_criterio × peso).

## Umbral GO (fíjalo ANTES de evaluar)

- Mínimo por criterio de calidad (1–4): **≥ 3 / 5** (ninguno por debajo).
- Media ponderada global: **≥ 3.5 / 5**.
- Detección de visión sobre boceto: tasa de acierto **≥ \_\_\_ %** (define el mínimo
  viable; por debajo → replantear UX a plantillas en vez de boceto libre).

> Ajusta estos números con criterio de Producto. Lo importante es **fijarlos antes**
> de ver las muestras.

## Hoja de puntuación (una por proveedor)

| Entrada | Realismo 3D | Plano 2D | Inpaint | Artefactos | Coste USD | Latencia s |
|---|---|---|---|---|---|---|
| input-01 | | | | | | |
| input-02 | | | | | | |
| … | | | | | | |
| **Media** | | | | | | |

## Evaluación con usuarios objetivo

Además de la rúbrica interna, una **sesión con usuarios objetivo**: muéstrales
muestras ciegas (sin saber qué proveedor) y pregunta **"¿pagarías por esto?"**.
Vuelca a `user-eval-results.md`. La opinión del equipo no sustituye a la del
usuario que paga.
