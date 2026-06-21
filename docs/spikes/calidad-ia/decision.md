# Decisión F-S0 — GO/NO-GO + proveedor de imagen (§9.1)

> **Plantilla.** Se rellena tras ejecutar el arnés y la evaluación. Esta decisión
> es el **gate de M2**: GO → M2 arranca con el proveedor fijado; NO-GO → M2 se
> detiene y se replantea.

**Fecha:** _(pendiente)_ · **Decisores:** IA + Producto

## Resultado comparativo

| Proveedor | Realismo 3D | Plano 2D | Inpaint | Artefactos | Coste/img | Latencia | Ponderada | Disponible |
|---|---|---|---|---|---|---|---|---|
| FLUX | | | | | | | | ✅ implementado |
| Nano Banana | | | | | | | | ✅ implementado (vía OpenRouter) |
| Imagen | | | | | | | | ❌ no implementado (Vertex/OAuth, deprecado) |

Detección de visión sobre boceto: tasa de acierto = **\_\_\_ %** (umbral: \_\_\_ %).

## Veredicto

- [ ] **GO** — proveedor elegido: **\_\_\_\_\_\_** · `IMAGE_PROVIDER=____`
- [ ] **NO-GO** — motivo y replanteo: _(proveedor / pricing / segmento)_

## Justificación (calidad + coste)

_(Por qué este proveedor y este veredicto, con referencia a las muestras de
`samples/` y a los números de la rúbrica. Si NO-GO, qué se replantea.)_

## Consecuencias

- **GO** → fijar `IMAGE_PROVIDER` al ganador; cerrar los stubs de F3 con el
  proveedor adoptado; el coste real medido alimenta el pricing de F8 y la UX de
  espera de F6.
- **NO-GO** → detener M2; sesión con Producto.
