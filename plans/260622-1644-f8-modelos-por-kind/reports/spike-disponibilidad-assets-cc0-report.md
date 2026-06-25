# F8.1 · Spike de disponibilidad de assets CC0 — Reporte

**Fecha:** 2026-06-22 · **Rama:** `feat/canvas/f6-3d-navegable`

## Resultado: ✅ VÍA CONFIRMADA — hay cobertura amplia CC0 (Poly Pizza / Quaternius)

## Hallazgo principal: cómo descargar modelos de Poly Pizza
La descarga oficial (`POST /api/model/<id>/download/glb`) está **protegida con reCAPTCHA → 403**
por automatización. PERO el visor de cada página carga el modelo desde el CDN público:

```
https://static.poly.pizza/<uuid>.glb.br
```

Esa URL es pública (200) y `curl` la entrega **ya descomprimida** (el CDN envía
`Content-Encoding: br` y curl lo desinfla; el archivo resultante es un `.glb` válido, magic `glTF`).

**Procedimiento por modelo** (semi-manual, vía chrome-devtools):
1. Abrir `https://poly.pizza/m/<id>` en el navegador.
2. Leer las peticiones de red → la URL `static.poly.pizza/<uuid>.glb.br` (la del visor).
3. `curl -fsSL -o <kind>.glb "<esa url>"` → glTF válido.
4. Verificar con `gltf-transform inspect`.

## Modelos verificados en el spike (descargados a /tmp, glTF válido)
| Kind | Creador | ID Poly Pizza | CDN uuid | Peso (sin comprimir) | Licencia |
|---|---|---|---|---|---|
| nevera | Quaternius | 8sjRm8fnHh | f4b6db1d-…aaee393 | 17 KB | CC0 |
| armario | Quaternius | BHEVb1DIuH | 87908291-…d63f511b | 163 KB | CC0 |

Ambos low-poly, sin texturas (colores de material) → muy ligeros. **Mismo creador (Quaternius)**
= estilo coherente. Quaternius tiene un "Ultimate House Interior Pack" completo en Poly Pizza,
así que se pueden cubrir la mayoría de kinds del MISMO estilo (clave para que la sala no quede
con muebles de estilos dispares).

## Fuentes evaluadas
- **Poly Pizza (Quaternius/Kenney, CC0)**: ✅ la mejor cobertura de interior; descarga vía CDN del
  visor (procedimiento de arriba). reCAPTCHA solo bloquea el botón oficial, no el CDN.
- **Khronos glTF-Sample-Assets**: pocos de mobiliario doméstico (ya usados silla/sofá); descartado
  para ampliar.
- **Quaternius GitHub**: no aloja los packs (están en su web/itch como ZIP). Vía Poly Pizza es mejor.

## Subset propuesto para la fase 2 (kinds prioritarios, todos en Poly Pizza/Quaternius CC0)
nevera ✅, armario ✅ (ya descargados); + cama, inodoro, lavabo, ducha, mesa, tv, horno, fregadero,
encimera, planta. Buscar cada uno por su nombre en Poly Pizza filtrando creador **Quaternius** para
mantener el estilo. Lo que no aparezca en Quaternius → Kenney (también CC0) o placeholder.

## Decisión
GO para fase 2. Integrar el subset (empezando por nevera y armario, ya en /tmp), todos del estilo
Quaternius cuando sea posible. El placeholder cubre los kinds sin modelo.

## Preguntas abiertas
- ¿Cuántos kinds integrar en v1? Propongo el subset de arriba (~12); si el peso total preocupa, recortar.
- Procedimiento semi-manual por modelo (abrir página + leer red): aceptable para ~12 modelos una vez.
