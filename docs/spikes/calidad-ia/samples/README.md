# Muestras generadas

El arnés vuelca aquí los outputs, un subdirectorio por proveedor:

```
samples/
  flux/
    input-01.generate.png   # render 3D
    input-01.inpaint.png    # resultado de inpainting
    run.json                # coste + latencia por entrada
  nano-banana/
  imagen/
```

`run.json` (lo escribe el arnés):

```json
{
  "provider": "flux",
  "ranAt": "2026-06-20T22:00:00.000Z",
  "results": [
    { "id": "input-01", "op": "generate", "ms": 4200, "costUsd": 0.03, "assetUrl": "..." }
  ]
}
```

> Las muestras **no** deben contener PII. Si un output revela domicilio/personas,
> exclúyelo del repo.
