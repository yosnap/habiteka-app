# Entradas del spike

15–20 casos reales y representativos. Cada caso es un par (boceto/foto + prompt) y,
para los bocetos, su **ground-truth** de detección.

## Reglas

- **Anonimizar** antes de añadir: sin EXIF/geo, sin caras/matrículas visibles.
- Reales, no sintéticos ideales: bocetos a mano alzada y fotos de viviendas como
  las que subiría un usuario.
- Si una imagen revela domicilio o personas identificables, **no** se commitea.

## Estructura

```
inputs/
  cases.json            # lista de casos: id, archivo, prompt, ground-truth de visión
  input-01.jpg          # boceto o foto (anonimizada)
  input-02.jpg
  ...
```

## Formato de `cases.json`

```json
[
  {
    "id": "input-01",
    "file": "input-01.jpg",
    "kind": "boceto",
    "prompt": "Render 3D realista de este salón con estilo nórdico",
    "groundTruth": { "walls": 4, "doors": 1, "windows": 2, "pillars": 0 }
  }
]
```

`groundTruth` solo aplica a bocetos (para medir la detección de visión). Para fotos
sin anotación, omítelo.
