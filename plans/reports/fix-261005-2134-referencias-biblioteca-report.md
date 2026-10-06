# Biblioteca de referencias y elementos críticos

## Resultado

Selector de imágenes guardadas después de preparar vistas: cenital para alzados,
isométrica y exterior; isométrica para dron. Muestra estados, previsualización,
aceptación explícita y motivos de incompatibilidad. Recuperar ajustes conserva
los ángulos solicitados y el ID, pero exige preparar de nuevo las capturas.
No se han aceptado diseños ni iniciado generaciones durante esta corrección.

El servidor consulta solo organización/proyecto/zona autorizados, pagina 40
resultados, comprueba revisiones y borrador y revalida el ID antes de leerlo.
Una selección inválida no se sustituye por otra. También las vistas lejanas
exigen referencias aceptadas. La ortofoto conserva sus reglas.

Guía técnica distingue sanitarios, placas y vehículos por tipo canónico.
Inventario de aparatos por estancia incluye cocina modular. Auditoría v5
comprueba cantidades y tipos; una incertidumbre no equivale a cero.
El diseño aceptado prevalece en las vistas derivadas. No certifica fidelidad
visual ni modifica imágenes antiguas.

## Validación

- 136 pruebas en 14 archivos de generación, auditoría, referencias y biblioteca.
- TypeScript y ESLint de archivos afectados sin errores.
- `npm run docs:updates`, `npm run docs:build` y `git diff --check` correctos.
- Chrome: biblioteca muestra aceptación e incompatibilidades; recuperación
  de ajustes habilita referencia manteniendo frontal. Sin aceptar ni generar.
- Borradores existentes conservados; revisión guardada abierta en pestaña
  independiente. Sin commit, despliegue ni gasto de generación.

## Límites

La corrección del inventario/raster/auditoría se prueba con fixtures y dobles
de visión. No se ha probado un nuevo resultado IA pagado: su realismo y fidelidad
deben inspeccionarse por el usuario antes de aceptar.

Documentación: guía Imágenes, Novedades, `docs/render-exterior-fidelity.md` y
versiones/requisito de aceptación en `docs/system-architecture.md`.
