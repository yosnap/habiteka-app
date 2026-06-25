# Brainstorm — Flujo foto → zona → render coherente

Fecha: 2026-06-23 · Modo: brainstorm (sin flags)

## Problema

El usuario subió un boceto de fachada y el render generó una casa moderna que NO tiene nada
que ver: el render IGNORA la foto subida. Además no se pueden subir varias fotos ni por zona.

## Diagnóstico (scout verificado)

3 flujos desacoplados; toda la infraestructura por-zona ya existe (faltan los conectores):

| # | Desconexión | Ubicación | Impacto |
|---|-------------|-----------|---------|
| A | La foto NO llega al render (flujo chat) | `entrega.ts:109` (referenceImage solo si `input.sketch`) | El render se genera ciego, solo con prompt de texto → no respeta la foto |
| B | La foto NO puebla el plano 2D | `detectPlanFromPhoto` no persiste; detección solo texto | Plano vacío; detección efímera |
| C | Una sola foto por zona | `ImageUpload` solo en fase `ingesta` del chat | El botón desaparece al avanzar |
| D | Entregables no agrupados por zona | `deliverables/page.tsx` | Renders mezclados |

Piezas reutilizables: `SourceImage/CanvasState/Deliverable/AgentState` por `zoneId`; img2img ya
soportado (NanoBanana acepta `referenceImage`); `SourceImage.role` (PRIMARY/SECONDARY);
`persistSourceImage`; `detectedToObjects`; `insertObjects`; zone switcher; `latestPrimaryId(pid,zoneId)`;
`ProjectZone.kind` (interior/entrada/aérea/trasera…).

## Decisiones (usuario)

1. **Caso de uso: AMBOS** (interiores y exteriores). Se distinguen por `ProjectZone.kind`; el
   prompt del render se adapta (interior → estancia + muebles/catálogo; exterior → fachada).
2. **Foto→render: las dos por fases** — primero img2img directo (rápido), luego vía plano.
3. **Subida: panel de fotos por zona reutilizable** (asistente + plano).

## Flujo propuesto (aprobado)

Principio: la foto es la fuente; el render SIEMPRE la respeta (img2img); todo por zona; subida
en un panel reutilizable.

### Fase 1 — El render respeta la foto (img2img en el chat) [ALTO IMPACTO]
- `handleDeliver`: cargar la foto PRIMARY de la zona (presigned/bytes) y pasarla como
  `referenceImage` al generador, como ya hace el lienzo. Quitar la condición que lo limita a
  `input.sketch`.
- El prompt distingue interior/exterior por `kind` de la zona.
- Resuelve la captura. Cambio acotado.

### Fase 2 — Panel de fotos por zona (reutilizable) [resuelve "no puedo subir más"]
- Componente subir / ver miniaturas / elegir foto ACTIVA de la zona (usa `SourceImage.role`).
- Usable desde el asistente y el plano. La foto activa es la que usa el render.

### Fase 3 — Vía plano (futuro)
- Foto → detección → PERSISTIR objetos en el plano de la zona → render desde el plano editable.

## Aclaraciones

- "Zona vacía en el plano": ya ocurre hoy (sin `CanvasState` → plano vacío); no hay que crear
  nada al crear la zona.
- Tensión interior/exterior: en exteriores, Fase 1 (img2img) funciona; plano/3D/catálogo aportan
  poco. Aceptable para empezar.
- Desconexión D (agrupar entregables por zona) = mejora menor, no bloqueante; opcional en F2.

## Riesgos

- Img2img desde foto de baja calidad / boceto a lápiz: el modelo puede "inventar". Mitigar con
  el prompt (respeta estructura) y, si hace falta, fuerza de referencia.
- Coste: cada generación cobra; la idempotencia ya existe (`deliver:project:vN`).

## Siguiente paso

Plan de implementación empezando por Fase 1 (img2img que respeta la foto).
