# Fase 3 — Elementos avanzados (techo, pared, arquitectura)

**Depende de:** Fase 0, Fase 1, Fase 2  
**Objetivo:** Soporte completo para iluminación de techo, elementos de pared (enchufes, cuadros, apliques), cornisas, cenefas LED, techos decorativos y cualquier elemento que no sea "mueble de suelo".

---

## Tipos de elemento por zona

### Zona Techo (`placement = 'ceiling'`)

| Kind | Descripción | Renderizado 3D |
|------|-------------|---------------|
| `ceiling_light` | Plafón / foco empotrado | Disco o caja pegada al techo, emite luz |
| `recessed_light` | Foco empotrado tipo downlight | Disco enrasado, `y = ceilingHeightM` exacto |
| `pendant_lamp` | Lámpara colgante (cable desde techo) | Cable + cuerpo a `elevationM` del techo |
| `ceiling_fan` | Ventilador de techo | Modelo GLB, aspas animadas opcionales |
| `led_strip` | Cenefa LED perimetral | Línea/box tenue a lo largo del perímetro de la pared |
| `beam` | Viga de madera | Caja rectangular a lo largo de un eje, a altura configurable |
| `cornice` | Cornisa perímetro | Moldura continua donde techo encuentra pared |
| `skylight` | Lucernario / claraboya | Hueco cuadrado en el techo con cristal |

### Zona Pared (`placement = 'wall-surface'`)

| Kind | Descripción | Renderizado 3D |
|------|-------------|---------------|
| `outlet` | Enchufe eléctrico | Pequeño rectángulo blanco sobre la pared |
| `switch` | Interruptor de luz | Rectángulo blanco con palanca |
| `thermostat` | Termostato inteligente | Caja circular/cuadrada con pantalla |
| `wall_sconce` | Aplique de pared | Modelo GLB, emite luz |
| `art_frame` | Cuadro / obra de arte | Rectángulo con imagen o color |
| `radiator` | Radiador | Modelo GLB pegado a la pared |
| `tv_mount` | Soporte de TV en pared | TV pegada a la pared sin mueble |

### Zona Techo decorativo (futuro extendible)

Posibilidad de definir el material del techo por zona:
```ts
interface ZoneCeiling {
  material: 'flat' | 'coffered' | 'barrel' | 'exposed_beam'
  color?: string
  heightM?: number  // altura personalizada por zona
}
```

---

## Comportamiento en 2D (canvas)

Los elementos `ceiling` y `wall-surface` se muestran en el plano 2D con representación diferenciada:

- **Ceiling:** círculo punteado con icono de la lámpara. Al seleccionar muestra tamaño pero no ocupa "espacio de suelo".
- **Wall-surface:** pequeño rectángulo sobre la línea del muro más cercano, no se arrastra libremente por el suelo.
- **LED strip / cornice:** línea paralela a los muros (se posiciona automáticamente a 10cm de cada muro).

En 2D, estos elementos tienen **capa visual separada** (más tenue, semitransparente) para no confundir con el amueblado de suelo.

---

## Comportamiento en 3D

### Ceiling lights

```ts
// docToScene — ceiling placement
const worldY = scene.ceilingHeightM - (obj.elevationM ?? 0);
// elevationM = 0 → pegado al techo
// elevationM = 0.5 → cuelga 50cm del techo (lámpara colgante)
```

- `recessed_light`: siempre `y = ceilingHeightM`, geometría de disco
- `pendant_lamp`: cable procedural desde `ceilingHeightM` hasta `worldY`
- `led_strip`: sigue el perímetro interior de la sala a `y = ceilingHeightM - 0.05`

### Luz de techo como fuente de luz real

Cada `ceiling_light`, `pendant_lamp`, `wall_sconce` con `light` prop activo → genera un `PointLight` o `SpotLight` en Three.js exactamente en su posición 3D.

```ts
interface LightProps {  // ya existe, se extiende
  on: boolean
  color: string
  intensity: number
  temperature?: number  // nuevo: Kelvin (2700K = cálido, 6500K = frío)
  angle?: number        // nuevo: para SpotLight (focos dirigibles)
  castShadow?: boolean
}
```

Temperatura de color → convierte K a RGB con algoritmo de Planckian locus.

### LED strip (cenefa)

Geometría procedural: sigue el polígono del suelo (`scene.floor.polygon`) con offset de 10cm hacia el interior, a la altura del techo. Una `LineLoop` Three.js + `PointLight` difuso de baja intensidad sobre la línea.

### Cornisa

Moldura procedural (extrusión de perfil a lo largo del perímetro). Perfil configurable: plano, media caña, ogee (S). En Fase 3 solo perfil plano; el resto en Fase 5.

---

## Panel de propiedades ampliado

El `ObjectPropertiesPanel` se extiende con campos por placement:

**ceiling:**
- Elevación desde techo (cm) — cuánto cuelga
- Encendido (toggle)
- Color de luz (color picker)
- Temperatura K (slider 2700–6500)
- Ángulo (para focos dirigibles)

**wall-surface:**
- Altura desde suelo (cm)
- Para `wall_sconce`: igual que ceiling_light
- Para `art_frame`: upload de imagen

**wall-child (ventana):**
- Alféizar cm (ya existe)
- Anchura / Alto (ya existe)
- Tipo de vidrio: simple / doble / oscurecido

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/canvas/3d/doc-to-scene.ts` | ceiling + wall-surface position logic |
| `src/components/canvas/3d/ceiling-layer.tsx` | NUEVO: plafones, lámparas, LEDs |
| `src/components/canvas/3d/wall-surface-layer.tsx` | NUEVO: enchufes, apliques, cuadros |
| `src/components/canvas/3d/led-strip-layer.tsx` | NUEVO: cenefa LED perimetral |
| `src/components/canvas/3d/object-properties-panel.tsx` | Campos por placement |
| `src/canvas/3d/wall-openings.ts` | Tipo vidrio para ventanas |
| `src/canvas/light.ts` | Temperatura de color (K → RGB) |
| `tests/canvas/3d/ceiling-placement.test.ts` | NUEVO |
| `tests/canvas/light-temperature.test.ts` | NUEVO |

---

## Criterios de aceptación

- [ ] `ceiling_light` colocado desde catálogo aparece pegado al techo (no flotando)
- [ ] `pendant_lamp` cuelga X cm del techo según `elevationM`
- [ ] Temperatura de color K cambia el tono de la luz en tiempo real en 3D
- [ ] `led_strip` aparece como línea de luz perimetral a la altura del techo
- [ ] `outlet` aparece como rectángulo sobre el muro, a la altura configurada
- [ ] `wall_sconce` emite luz desde su posición en la pared
- [ ] `art_frame` permite subir imagen que se muestra en el cuadro en 3D
- [ ] Panel de propiedades muestra campos correctos según placement
- [ ] Al seleccionar una ventana: campo "Tipo de vidrio" disponible
