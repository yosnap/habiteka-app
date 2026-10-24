# Design System — Habiteka

> Fuente de verdad de los tokens: [`src/styles/tokens.css`](../../src/styles/tokens.css)
> (`@theme` de Tailwind v4). Ningún componente hardcodea hex: usa las utilidades
> generadas (`bg-brand-500`, `text-ink`, …) o las variables CSS.

## Paleta

Cálida, de dominio hogar/interiorismo. Definida en oklch para consistencia
perceptual. Todos los pares texto/fondo cumplen **WCAG 2.2 AA (≥ 4.5:1)** — lo
verifica `tests/styles/design-tokens.test.ts`.

| Token                                     | Uso                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `brand-500` / `brand-600` / `brand-700`   | Acciones primarias, enlaces, acentos. `700` como texto sobre claro. |
| `brand-50` / `brand-100`                  | Fondos de realce suaves.                                            |
| `ink` / `ink-soft`                        | Texto principal / secundario.                                       |
| `surface` / `surface-muted`               | Fondo base / superficies elevadas.                                  |
| `line`                                    | Bordes y separadores.                                               |
| `success` / `warning` / `danger` / `info` | Estados semánticos.                                                 |

## Tipografía

- `font-sans` (Geist) para UI y contenido. `font-mono` (Geist Mono) para datos
  técnicos (cotas, medidas).
- Escala: `text-xs` (12) · `sm` (14) · `base` (16) · `lg` (18) · `xl` (20) ·
  `2xl` (24) · `3xl` (30). Cuerpo a 16px mínimo.

## Espaciado y forma

- Escala de espaciado base 4px (utilidades estándar de Tailwind).
- Radios: `--radius-card` (0.75rem) para tarjetas/paneles; `--radius-control`
  (0.5rem) para botones/inputs.
- Sombras: `--shadow-panel` (paneles), `--shadow-float` (popovers/sheets).

## Componentes base → shadcn/ui

| Componente | Origen shadcn | Uso en Habiteka                                                     |
| ---------- | ------------- | ------------------------------------------------------------------- |
| Button     | `button`      | Acciones (variantes: primary brand, secondary, ghost, destructive). |
| Card       | `card`        | Tarjeta de entregable, plantilla de arranque.                       |
| Dialog     | `dialog`      | Confirmaciones (borrar proyecto).                                   |
| Sheet      | `sheet`       | Paneles colapsables de chat/entregables en tablet.                  |
| Tabs       | `tabs`        | Cambiar entre entregables / add-ons.                                |
| Tooltip    | `tooltip`     | Hints de affordance (feedback por zona).                            |
| Toast      | `sonner`      | Confirmaciones efímeras (guardado, error de IA).                    |
| Skeleton   | `skeleton`    | Estados de carga (análisis visual, generación).                     |
| Progress   | `progress`    | Progreso de análisis/generación.                                    |

## Estados por componente clave

| Componente      | Loading                                    | Vacío                                            | Error                                                | Deshabilitado                    |
| --------------- | ------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------- | -------------------------------- |
| **Canvas**      | Skeleton del lienzo + progress de análisis | Onboarding guiado (plantillas)                   | Banner "no pudimos procesar la imagen" + reintentar  | —                                |
| **Chat**        | Burbujas skeleton                          | Mensaje de bienvenida + sugerencias              | Toast "el asistente no está disponible" + reintentar | Input bloqueado mientras procesa |
| **Entregables** | Card skeleton                              | "Aún no hay diseños — completa tus preferencias" | Card de error por entregable + regenerar             | —                                |

## Reglas

- La [referencia UX de WalkMyHome](walkmyhome-reference.md), revisada en Comet, orienta vistas/diseño del espacio de trabajo, navegación 3D, ayuda contextual y resultados. Los tres modos usan barra izquierda oscura con modos/tareas, Ayuda y Ajustes inferiores y paneles flotantes claros. El plano 2D comparte navegación y paneles, manteniendo CanvasView y sus comandos de construcción. Se conservan los tokens y la identidad de Habiteka; no se agregan motores o funciones por imitación. El audio del espacio de trabajo queda pendiente.
- Foco visible en todo elemento interactivo (ver [accessibility.md](accessibility.md)).
- Escena: tres pestañas por planta, grupos y paredes desplegables, huecos hijos por `wallId`, doce filas iniciales y aumentos de hasta veinticuatro. Nombre persistente en campos existentes; visibilidad individual en estado de editor, separada de geometría, capturas y recorridos. Acciones bloqueadas durante construcción/colocación.
- En los tres modos, el lateral contiene siete grupos desplegables; Exterior, Recorrido y Propiedades se ubican dentro de Construir, Herramientas y Escena. Las vistas/herramientas rápidas e iluminación usan menús flotantes superiores y la cámara una barra inferior centrada. Paneles con altura de contenido, límites de viewport y scroll interno; sin arrastre. CSS limitado a `.spatial` y controles compactos activados solo desde EditorShell.
- `prefers-reduced-motion`: desactivar transiciones no esenciales.
- Sin jerga de fases en la UI (ver [canvas-onboarding.md](canvas-onboarding.md)).
