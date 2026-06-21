# F-CAT · Catálogo extensible: nuevos elementos del plano

**Estado: ✅ COMPLETADA.** Verificado: typecheck OK, eslint OK, 55 tests en `tests/canvas/`
(9 nuevos de catálogo), code-review sin críticos/altos. Rama: `feat/canvas/f2-vistas-por-imagen`.
Etapa B (habilita decoración). Aplica el principio rector: añadir un elemento debe ser DECLARATIVO.

## Objetivo

Añadir elementos que hoy faltan (alfombra, planta, chimenea, foco/luz simple…) y, sobre todo,
ASEGURAR que el catálogo escala: añadir un elemento = entrada en `catalog.ts` + su forma de dibujo,
sin tocar store/serialize/UI. Reforzar esa propiedad donde aún no se cumple.

## Estado verificado (scout)

Añadir un `kind` hoy toca 3 sitios (los 3 son declarativos y locales):
1. `StructKind` en `src/canvas/types.ts` — el literal del tipo.
2. `CATALOG` en `src/canvas/catalog.ts` — la entrada (label + tamaño por defecto).
3. `shapeFor` en `src/components/canvas/object-shapes.tsx` — la forma vectorial en planta.

Ya son agnósticos (NO hay que tocarlos): store (itera el doc), serialize (valida contra
`CATALOG_BY_KIND`), paleta/UI (itera `CATALOG`), serialize-doc-to-prompt (usa `CATALOG_BY_KIND`).
Buena base. El único riesgo: `shapeFor` es un `switch` sin `default` → si se añade un kind sin
forma, no se dibuja (el compilador avisa por exhaustividad, pero conviene un fallback seguro).

## Decisiones de diseño

- **Mantener los 3 puntos declarativos** (type + catálogo + forma). NO introducir un registro
  dinámico runtime: el `StructKind` como unión de literales da seguridad de tipos en todo el código
  (serialize, prompt, store) — perderla por un `string` genérico sería un retroceso (YAGNI/KISS).
- **Fallback de forma genérica:** `shapeFor` gana un `default` (caja simple) para que añadir una
  entrada al catálogo NUNCA rompa el render aunque falte la forma fina. **Trade-off consciente:** el
  `default` elimina la exhaustividad estricta del compilador (antes, un kind sin `case` era error de
  compilación). A cambio se gana degradación elegante: un kind sin forma propia se dibuja como caja
  genérica (visible y editable) en vez de no dibujarse. El guardrail de tests cubre que cada kind
  tenga ENTRADA de catálogo, pero NO que tenga forma propia → un kind sin forma degrada en silencio
  a caja genérica. Se acepta como comportamiento deseado (resiliencia > fallo).
- **Nuevos elementos de esta fase (decoración básica):** alfombra, planta, chimenea. Son los que
  habilitan la etapa B sin entrar todavía en luces de 1ª clase (eso es F-LUZ: color/intensidad).
  Un `foco` simple puede entrar como elemento de dibujo, pero SIN atributos de luz (los lleva F-LUZ).

## Archivos a modificar

- `src/canvas/types.ts` — añadir los nuevos kinds a una familia (p. ej. `DecorKind = 'alfombra' |
  'planta' | 'chimenea'`) y sumarla a `StructKind`.
- `src/canvas/catalog.ts` — nueva categoría `decoracion` con sus entradas (label + tamaños).
- `src/components/canvas/object-shapes.tsx` — formas de los nuevos kinds + `default` de fallback.

## TDD / Validación

- Test (lógica pura, sin Konva): por cada `kind` de `StructKind` existe entrada en `CATALOG_BY_KIND`
  (catálogo completo respecto al tipo) — afín al test de derivación de F1b. Esto es el guardrail de
  escalabilidad: si alguien añade un kind al type y olvida el catálogo, el test falla.
- Test: `CATALOG_BY_KIND` no tiene kinds huérfanos (todas las entradas pertenecen a `StructKind`).
- Regresión: serialize sigue descartando kinds desconocidos; los nuevos kinds hacen round-trip.
- Verificación: typecheck, eslint, tests focales `tests/canvas/`. NO suite completa (vacía la BD de
  dev). Nota: con el `default`, el compilador ya NO obliga a dar forma a cada kind nuevo (cae al
  fallback); el guardrail vivo es el test de completitud catálogo↔tipo.

## Riesgos y rollback

- Riesgo bajo. Es aditivo: nuevos kinds no afectan a los existentes.
- `shapeFor` sin `default` hoy → al añadir kinds el compilador obliga a darles forma; el `default`
  nuevo elimina el riesgo de "kind sin dibujo".
- Rollback: quitar los kinds añadidos (aditivos).

## Fuera de alcance (anotado)

- Luces de PRIMERA CLASE (color, intensidad, dirección) → F-LUZ. Aquí, a lo sumo, un foco como
  forma de dibujo sin atributos lumínicos.
- Materiales/acabados de cada elemento → F5b.
- Recomendación de decoración por IA → F4.

## Checklist de entrega

- [x] Nuevos kinds en `types.ts` (familia `DecorKind`: alfombra, planta, chimenea).
- [x] Entradas en `catalog.ts` (categoría `decoracion` con label + tamaños).
- [x] Formas en `object-shapes.tsx` + `default` de fallback seguro.
- [x] Tests: catálogo completo respecto al tipo (guardrail `Record<StructKind,true>` + igualdad de conjuntos).
- [x] Verificación: typecheck, eslint, 55 tests focales; code-review sin críticos/altos.
