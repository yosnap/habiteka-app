# Interfaz de techo e iluminación

## Implementación

- Acceso «Techo y luces» en cabecera, utilizable en 2D/3D y consulta en solo lectura.
- Panel adaptable al ancho, con scroll propio, campos etiquetados, foco visible y controles de al menos 44 px.
- Usa tokens existentes del editor: neutros y acento verde; no incorpora tipografías ni dependencias.
- Habitaciones identificadas por etiqueta interior y superficie. Exteriores omitidos según contrato geométrico.
- Añadir/retirar techo; tipo plano/falso techo, descenso y acabado. Modo visual independiente de material.
- Colgante, plafón y foco empotrado. Coordenadas, caída, acabado, temperatura, flujo y encendido editables.
- Foco deshabilitado cuando no existe falso techo con 8 cm mínimos de descenso.
- Propuesta local por estilo moderno/mediterráneo; anuncia que no consume créditos IA. Revisión por luminaria, descarte individual y aceptación atómica; conserva existentes.
- Símbolos 2D seleccionables y arrastrables; contorno de techo seleccionado no intercepta el mobiliario.
- Topología temporalmente inválida no rompe la capa ni el panel. Muestra avisos del dominio.

## Archivos

- `src/components/editor-v2/ceiling-lighting-panel.tsx`
- `src/components/editor-v2/ceiling-lighting-layer.tsx`
- `src/components/editor-v2/ceiling-lighting.module.css`
- Integración acotada: `editor-shell.tsx`, `document-layer.tsx`.

## Validación

ESLint de los cuatro TSX: correcto. TypeScript pendiente de los exports de dominio en implementación paralela. Validación visual completa pendiente del flujo integrado; no se declara realizada.

## Referencias y límites

Consultadas reglas globales, plan aceptado, `docs/ux/design-system.md` y `docs/ux/editor-spatial-controls.md`. No existen `docs/development-rules.md` ni `docs/design-guidelines.md`; la fuente de diseño efectiva es `docs/ux/design-system.md` y los tokens locales de `editor.module.css`. No modificado dominio, store, escena 3D ni prompts.

Preguntas pendientes: ninguna.
