# Catálogo: tipos de puerta y ventana y muebles realistas CC0

Estado: fases 1–5 hechas sin commit · 2026-10-05. Hay 27 tipos de puerta y ventana con aspecto, fotos en el catálogo, 117 materiales y 26 alfombras CC0, y una fábrica Blender con 351 piezas propias en 9 familias: sofás, camas, comedor, exterior, taburetes, baño, almacenaje, electrodomésticos y plantas. Hay 4 estancias nuevas. Pendiente: el resto de las oleadas 2–4 del catálogo maestro (lámparas de techo con modelo, infantil con cuna y litera, radiadores, aire acondicionado y elementos de pared).

## Objetivo

El usuario necesita reconocer y colocar muchos más elementos: puerta de entrada ancha, puertas correderas (por ejemplo,
para salir a un patio interior), doble hoja, ventanas de varios tipos, y muebles variados (armarios, mesas con sus sillas,
alfombras, lavadoras, microondas, camas, mesillas con lámparas, taburetes de cocina americana…).

## Decisiones del usuario (2026-10-05)

- Fuentes de modelos 3D: **solo CC0** (Poly Haven, Kenney, Quaternius). Nada de BlenderKit ni Sketchfab CC-BY.
- Estilo 3D: **realista (Poly Haven)**. El 3D del editor es guía; el render final sale del diseño IA aceptado.
- Prioridad: puertas y ventanas + muebles nuevos (correderas a patio, armarios, mesas con sillas, alfombras,
  lavadoras, microondas…).

- Fabricación propia: **Blender por script** (fase 5). Catálogo maestro por oleadas en `catalogo-maestro.md`/`.json`.
- Estancias nuevas: **infantil, recibidor, lavadero y garaje** (catálogo, filtros, Amueblar y lectura del boceto; los
  planos existentes no cambian).
- Plantas de interior: **Blender con hojas de textura CC0** (monstera, ficus, olivo, sansevieria, palmera…).

## Fases

1. **Tipos de puerta y ventana** (por código, sin descargas): entrada blindada, abatible de una hoja, doble hoja,
   corredera vista, corredera empotrada, plegable, vidriera; ventana abatible, corredera, balconera (hasta el suelo),
   fija. Símbolo 2D propio, modelo 3D, selector en Propiedades (ModernSelect), barrido de puerta correcto
   (corredera sin arco), rasterizado del plano para la IA, y tipo por defecto razonable (puerta de entrada en fachada).
2. **Muebles realistas de Poly Haven**: canal de importación (descarga glTF CC0 → GLB comprimido con texturas
   reducidas), procedencia en `public/models/cc0/manifest.json`, alta en `furniture-assets.ts` con medidas reales.
   Prioridad: taburetes de barra, mesillas, lámparas, aparadores/cómodas, sofás, sillas de comedor, mesas, camas,
   estanterías. Lo que Poly Haven no tenga (lavadora, microondas, armario moderno…) se completa con Kenney o
   Quaternius CC0, o se mantiene el modelo actual.
3. **Reconocimiento**: lectura del boceto y Amueblar con los tipos nuevos (puerta de entrada, corredera a patio,
   barra de cocina americana con taburetes, lámparas sobre mesillas, alfombras).
4. **Catálogo amplio «como Planner 5D»** (petición 2026-10-05): biblioteca CC0 de materiales PBR (ambientCG ~2.000 y
   Poly Haven ~865 texturas; selección curada de 80–120 para suelos, paredes y fachadas) y alfombras realistas
   texturizadas. Fuentes descartadas: el catálogo de Planner 5D (propietario), Sketchfab (su búsqueda CC0 no sirve) y
   KIE (no ofrece generación 3D). Pendiente de decisión del usuario: generar con IA (imagen → 3D) lo que no existe en
   CC0 (lavadora, microondas, armario moderno…), con proveedor y gasto autorizados expresamente.
5. **Fábrica de muebles propia con Blender** (decisión del usuario 2026-10-05: «Blender por script»): generador
   paramétrico en Python (Blender 5.2 sin interfaz) que crea familias completas con variantes de medidas y materiales CC0:
   sofás (2/3 plazas, chaise longue, rinconera, sofá cama, modular), exterior (sofás, sillas, tumbonas, mesas), comedores
   con sus sillas, camas con cabecero y más puertas. Es la base del negocio: después se modelarán los productos del stock
   de las tiendas.

## Criterios de aceptación

- Cada tipo de puerta/ventana se elige en Propiedades y se ve distinto en 2D y 3D; los documentos antiguos siguen
  abriéndose igual (por defecto, `puerta-basic`/`ventana-basic`).
- Los modelos nuevos son CC0 con procedencia registrada, pesan poco (texturas ≤ 1k, GLB comprimido) y aparecen en el
  catálogo con nombre en español y medidas reales.
- Tests de los tipos y de la importación; documentación de usuario actualizada.
