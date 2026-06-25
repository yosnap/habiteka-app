# Fase 4 — Vistas profesionales y exportación

**Depende de:** Fase 2, Fase 3  
**Objetivo:** Generar vistas arquitectónicas profesionales (renders IA + shots automáticos), exportar plano en PDF con cotas, y compartir el proyecto con clientes.

---

## Tipos de vista

### 1. Renders IA (ya existe, mejorar)

El flujo actual (captura WebGL → img2img IA) se extiende:

| Tipo | Descripción |
|------|-------------|
| Perspectiva interior | Desde esquina a 1.5m de altura — como foto real desde dentro |
| Alzado frontal | Cámara ortogonal paralela a cada muro |
| Isométrica | Vista isométrica clásica desde arriba-diagonal |
| Cenital | Planta desde arriba (útil para comparar con 2D) |
| Detalle de zona | Recorte de una zona específica (cocina, baño) |

Mejoras al flujo:
- **Múltiples estilos en lote:** el usuario selecciona 3 estilos → se generan 3 renders en paralelo
- **Historial de renders por zona:** cada zona guarda sus renders anteriores con timestamp
- **Prompt enriquecido automáticamente:** se añade al prompt el contexto del plano (nº habitaciones, estilos de muebles detectados, paleta de colores dominante)

### 2. Shots automáticos de cada muro (alzados)

Al pulsar "Exportar alzados":
1. Para cada muro visible (no oculto), se posiciona la cámara ortogonal perpendicular a él
2. Se captura el frame WebGL
3. Se genera render IA del alzado
4. El resultado es un PDF multi-página: portada + planta + N alzados

### 3. Walkthrough (futuro, Fase 5)

Vista a nivel del suelo navegable con teclado/ratón. No en Fase 4 pero la arquitectura de cámara no debe impedirlo.

---

## Exportación PDF

### Contenido del PDF

```
Página 1: Portada
  - Nombre del proyecto, fecha, logo Habiteka
  - Render principal (perspectiva isométrica del diseño)

Página 2: Planta general
  - Plano 2D con cotas completas
  - Leyenda de elementos (muebles, puertas, ventanas)
  - Escala gráfica

Página 3–N: Alzados por muro
  - Vista ortogonal de cada muro con elementos montados
  - Cotas de altura (puerta: 210cm, ventana: alféizar 90cm, etc.)

Página N+1: Lista de materiales (BoM)
  - Tabla: elemento | cantidad | dimensiones | precio estimado (si tiene store_price)
  - Total estimado del amueblado
```

### Implementación

- Librería: `@react-pdf/renderer` (server-side, sin WebGL)
- Las imágenes de renders se almacenan previamente en R2
- El plano 2D se exporta como SVG → PNG → embed en PDF
- La BoM se genera desde `doc.objects` filtrando por `source`

### API Route

```
POST /api/projects/[id]/export/pdf
  body: { zoneId, includeAlzados, includeBoM, renderStyle }
  → genera PDF en background, devuelve jobId
  → webhook cuando listo → URL de descarga

GET  /api/projects/[id]/export/[jobId]
  → estado del job + URL cuando listo
```

---

## Sharing / cliente

### Link de solo lectura

```
GET /share/[token]
  → Vista 3D embebida (solo orbit, sin edición)
  → Panel de renders generados
  → Botón "Solicitar presupuesto"
```

El token se genera con `crypto.randomBytes(32)` y expira a los 30 días o cuando el propietario lo revoca.

### Embed para web del interiorista

```html
<iframe src="https://habiteka.com/embed/[token]" 
        width="800" height="600" frameborder="0" />
```

El embed muestra la vista 3D interactiva (orbit + zoom, no edición) con branding del interiorista.

---

## Panel de exportación (UI)

`src/components/export/export-panel.tsx`:

```
┌──────────────────────────────┐
│ Exportar proyecto            │
├──────────────────────────────┤
│ ○ Renders IA                 │
│   Estilos: [x] Moderno       │
│            [x] Minimalista   │
│            [ ] Nórdico       │
│   Vistas:  [x] Perspectiva   │
│            [ ] Alzados       │
│   [Generar renders →]        │
├──────────────────────────────┤
│ ○ PDF del proyecto           │
│   [x] Planta con cotas       │
│   [x] Alzados por muro       │
│   [x] Lista de materiales    │
│   [Descargar PDF →]          │
├──────────────────────────────┤
│ ○ Compartir con cliente      │
│   Link: habiteka.com/s/xyz   │
│   [Copiar] [Revocar]         │
└──────────────────────────────┘
```

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/components/export/export-panel.tsx` | NUEVO |
| `src/components/export/pdf-template.tsx` | NUEVO: @react-pdf template |
| `src/app/api/projects/[id]/export/route.ts` | NUEVO: job de export |
| `src/app/share/[token]/page.tsx` | NUEVO: vista pública |
| `src/components/canvas/3d/plan-3d-view.tsx` | Cámara ortogonal para alzados |
| `src/app/(app)/projects/[id]/_actions/agent-actions.ts` | Batch renders |

---

## Criterios de aceptación

- [ ] "Generar renders" produce N renders en paralelo (un render por estilo seleccionado)
- [ ] Los renders aparecen en historial de la zona con thumbnail y timestamp
- [ ] "Descargar PDF" genera PDF con portada + planta + alzados en < 30s
- [ ] PDF incluye BoM con precios si los items tienen `store_price`
- [ ] Link de sharing se genera con un clic, funciona sin autenticación
- [ ] El embed 3D permite orbitar pero no editar
- [ ] El link de sharing puede revocarse desde el panel del proyecto
